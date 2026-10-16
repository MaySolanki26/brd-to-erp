import { RefreshCw } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import {
  Button,
  CopyButton,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@brd/ui';
import { generatePassword } from '@/lib/generate-password';

interface PasswordFieldProps {
  name: string;
  label: string;
}

/** Shows a generated temporary password in the clear so the admin can copy and share it. */
export function PasswordField({ name, label }: PasswordFieldProps) {
  const { control, setValue, watch } = useFormContext();
  const value = String(watch(name) ?? '');

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <div className="flex items-center gap-2">
            <FormControl>
              <Input autoComplete="off" spellCheck={false} {...field} />
            </FormControl>
            <CopyButton value={value} label="password" toastOnCopy />
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Generate a new password"
              onClick={() => setValue(name, generatePassword(), { shouldValidate: true })}
            >
              <RefreshCw />
            </Button>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
