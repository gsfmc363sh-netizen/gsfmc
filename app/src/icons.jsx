const paths = {
  search: <path d="M11 4a7 7 0 105.29 11.71l3.5 3.5 1.42-1.42-3.5-3.5A7 7 0 0011 4zm0 2a5 5 0 110 10 5 5 0 010-10z" />,
  close: <path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z" />,
  book: (
    <path d="M6 3a3 3 0 00-3 3v13a2 2 0 012-2h13V4a1 1 0 00-1-1H6zm0 2h11v11H5V6a1 1 0 011-1zm2 2v2h7V7H8zm0 3v2h7v-2H8z" />
  ),
  table: <path d="M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1zm1 4v3h6V8H5zm8 0v3h6V8h-6zm-8 5v5h6v-5H5zm8 0v5h6v-5h-6z" />,
  print: <path d="M7 3h10v4H7V3zM5 8h14a2 2 0 012 2v6h-4v4H7v-4H3v-6a2 2 0 012-2zm4 8v3h6v-3H9zm8-4a1 1 0 100 2 1 1 0 000-2z" />,
  edit: <path d="M4 15.5V20h4.5l9.6-9.6-4.5-4.5L4 15.5zm15.7-9.3a1.2 1.2 0 000-1.7l-2.2-2.2a1.2 1.2 0 00-1.7 0l-1.8 1.8 4.5 4.5 1.2-1.2z" />,
  back: <path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z" />,
  menu: <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />,
  lock: <path d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 8V7a3 3 0 116 0v3H9z" />,
  scale: <path d="M12 2 3 5v2h18V5l-9-3zM4 8l-2 8a4 4 0 008 0L8 8H4zm12 0-2 8a4 4 0 008 0l-2-8h-4zM11 8v11H6v2h12v-2h-5V8h-2z" />,
  download: <path d="M11 3v10.2l-3.6-3.6L6 11l6 6 6-6-1.4-1.4-3.6 3.6V3h-2zM5 19h14v2H5v-2z" />,
  plus: <path d="M11 5v6H5v2h6v6h2v-6h6v-2h-6V5z" />,
  minus: <path d="M5 11h14v2H5z" />,
}

export function Icon({ name, size = 20, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {paths[name] || null}
    </svg>
  )
}
