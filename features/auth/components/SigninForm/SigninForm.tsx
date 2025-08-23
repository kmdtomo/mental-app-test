"use client";

import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Loader } from "lucide-react";
import { useFormState, useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/use-toast";

import { SocialLoginOptions } from "../SocialLoginOptiions/SocialLoginOptions";
import {
  SigninFormActionResult,
  signinWithEmailFormAction,
} from "./formAction";

type UserAuthFormProps = React.HTMLAttributes<HTMLDivElement>;

export function SigninForm({ className, ...props }: UserAuthFormProps) {
  const { toast } = useToast();

  const [state, formAction] = useFormState(
    async (prevState: SigninFormActionResult, formData: FormData) => {
      const result = await signinWithEmailFormAction(prevState, formData);
      if (result.success) {
        toast({
          title: "成功",
          description: "ログインに成功しました",
        });
        redirect("/voice-diary");
      } else {
        toast({
          title: "エラー",
          description: "ログインに失敗しました",
        });
      }
      return result;
    },
    {
      success: false,
    }
  );

  return (
    <div
      className={cn(
        "grid gap-6 rounded-lg p-4 backdrop-blur-3xl lg:rounded-none lg:p-0 lg:backdrop-blur-none",
        className
      )}
      {...props}
    >
      <form action={formAction}>
        <FormContent formState={state} />
      </form>
    </div>
  );
}

type FormContentProps = {
  formState: SigninFormActionResult;
};

const FormContent = ({ formState }: FormContentProps) => {
  const { pending } = useFormStatus();
  return (
    <div className="y-space-2">
      <div className="grid gap-1">
        <div className="space-y-1">
          <Input
            name="email"
            label="Email"
            placeholder="name@example.com"
            type="email"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect="off"
          />
          {formState.errors?.fieldErrors?.["email"] && (
            <p className="text-xs text-red-500">
              {formState.errors.fieldErrors["email"][0]}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <Input
            name="password"
            label="Password"
            placeholder="********"
            type="password"
            autoCapitalize="none"
            autoCorrect="off"
          />
          {formState.errors?.fieldErrors?.["password"] && (
            <p className="text-xs text-red-500">
              {formState.errors.fieldErrors["password"][0]}
            </p>
          )}
        </div>

        <Button disabled={pending} className="mt-2">
          {pending && <Loader className="mr-2 size-4 animate-spin" />}
          Sign In
        </Button>
      </div>
      <div>
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercas my-2">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>
        <SocialLoginOptions />
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {`Don't have an account yet?`}
          </span>
          <Link href="/signup" className="text-primary">
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
};
