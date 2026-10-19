import { loginSchema } from '@brd/shared';
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  FormError,
} from '@brd/ui';
import { useZodForm } from '@/hooks/use-zod-form';
import { useLogin } from './hooks/use-login';
import { ApiClientError } from '@/lib/api-client';

export function LoginPage() {
  const form = useZodForm(loginSchema, {
    defaultValues: { email: '', password: '' },
  });

  const login = useLogin();

  return (
    <div className="uab-login-page">
      <div className="uab-panel uab-login-card">
        <div className="uab-login-brand">
          <span className="uab-login-mark" aria-hidden="true">
            B
          </span>
          <div>
            <h1 className="uab-login-title">Sign in</h1>
            <p className="uab-muted">Enter your credentials to access the BRD Platform</p>
          </div>
        </div>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => login.mutate(data))}
            className="uab-form-grid"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="uab-span-all">
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="admin@brd.local"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="uab-span-all">
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Enter password"
                      autoComplete="current-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="uab-span-all">
              <FormError
                message={
                  login.error
                    ? login.error instanceof ApiClientError
                      ? login.error.message
                      : 'Something went wrong'
                    : null
                }
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              className="uab-span-all"
              loading={login.isPending}
              disabled={login.isPending}
            >
              {login.isPending ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
