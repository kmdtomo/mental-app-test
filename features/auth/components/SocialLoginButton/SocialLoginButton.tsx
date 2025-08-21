"use client";

import React from "react";
import { Provider } from "@supabase/supabase-js";
import { Loader } from "lucide-react";

import { Button, ButtonProps } from "@/components/ui/Button";
import { useToast } from "@/components/ui/use-toast";
import { createClient } from "@/lib/supabase/client";

type SocialLoginButtonProps = ButtonProps & {
  provider: Provider;
};

export const SocialLoginButton = ({
  provider,
  children,
  ...rest
}: SocialLoginButtonProps) => {
  const [pending, setIsPending] = React.useState(false);
  const { toast } = useToast();

  const signIn = async () => {
    setIsPending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });
      
      if (error) throw error;
    } catch (error) {
      toast({
        title: "Error",
        description: "ソーシャルログインに失敗しました。もう一度お試しください。",
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      variant="outline"
      type="button"
      disabled={pending}
      onClick={signIn}
      {...rest}
    >
      {pending ? <Loader className="animate-spin" /> : children}
    </Button>
  );
};
