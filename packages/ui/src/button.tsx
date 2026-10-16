export function Button({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>): React.JSX.Element {
  return <button {...props}>{children}</button>;
}
