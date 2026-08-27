import olefile, struct, zlib, json, re, sys
from Crypto.Cipher import AES


class SRand:
    def __init__(self, seed):
        self.v = seed & 0xffffffff

    def rand(self):
        self.v = (self.v * 214013 + 2531011) & 0xffffffff
        return (self.v >> 16) & 0x7fff


def decrypt_viewtext(raw):
    data = raw[4:260]
    seed = struct.unpack('<I', data[:4])[0]
    rnd = SRand(seed)
    rn = bytearray(256)
    i = 0
    while i < 256:
        fill = rnd.rand() & 0xff
        times = (rnd.rand() & 0x0f) + 1
        for _ in range(times):
            if i >= 256:
                break
            rn[i] = fill
            i += 1
    offset = (seed & 0xf) + 4
    out = bytes(data[j] ^ rn[j] for j in range(256))
    key = out[offset:offset + 16]
    enc = raw[260:]
    enc = enc[:len(enc) // 16 * 16]
    return zlib.decompress(AES.new(key, AES.MODE_ECB).decrypt(enc), -15)


def parse_paragraphs(body):
    pos = 0
    texts = []
    while pos + 4 <= len(body):
        hdr = struct.unpack('<I', body[pos:pos + 4])[0]
        tag = hdr & 0x3ff
        size = (hdr >> 20) & 0xfff
        pos += 4
        if size == 0xfff:
            size = struct.unpack('<I', body[pos:pos + 4])[0]
            pos += 4
        payload = body[pos:pos + size]
        pos += size
        if tag == 67:
            s = ''
            j = 0
            while j + 1 < len(payload):
                ch = struct.unpack('<H', payload[j:j + 2])[0]
                if ch < 32:
                    if ch in (1, 2, 3, 11, 12, 14, 15, 16, 17, 18, 21, 22, 23):
                        j += 16
                        continue
                    elif ch in (10, 13):
                        s += '\n'
                        j += 2
                        continue
                    else:
                        j += 2
                        continue
                s += chr(ch)
                j += 2
            s = s.encode('utf-16', 'surrogatepass').decode('utf-16', 'ignore')
            texts.append(s)
    return texts


def extract(hwp_path):
    ole = olefile.OleFileIO(hwp_path)
    secs = sorted(
        ['/'.join(s) for s in ole.listdir() if s[0] == 'ViewText'],
        key=lambda x: int(x.replace('ViewText/Section', '')),
    )
    paras = []
    for sec in secs:
        paras.extend(parse_paragraphs(decrypt_viewtext(ole.openstream(sec).read())))
    return paras


if __name__ == '__main__':
    paras = extract(sys.argv[1])
    json.dump(paras, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'{len(paras)} paragraphs -> {sys.argv[2]}')
