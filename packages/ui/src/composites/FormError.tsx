interface FormErrorProps {
  /** The message to show. Renders nothing when empty. */
  message?: string | null;
}

/** Form-level error under the fields (field errors use FormMessage). Announced to screen readers. */
export function FormError({ message }: FormErrorProps) {
  if (!message) return null;
  return (
    <p role="alert" className="uab-field-error">
      {message}
    </p>
  );
}
