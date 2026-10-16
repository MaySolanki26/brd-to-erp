import { loginSchema } from '@brd/shared';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-2xl font-bold text-primary-foreground">
            B
          </div>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Enter your credentials to access the BRD Platform</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => login.mutate(data))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="admin@brd.local" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {login.error && (
                <p className="text-sm text-destructive">
                  {login.error instanceof ApiClientError ? login.error.message : 'Something went wrong'}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={login.isPending}>
                {login.isPending ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
