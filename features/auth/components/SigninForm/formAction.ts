"use server";

import { signinWithEmailAction } from "@/actions/auth/actions";
import * as z from "zod";

const signinSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(6, "パスワードは6文字以上である必要があります"),
});

export type SigninFormActionResult = {
  success?: boolean;
  errors?: {
    formErrors?: string[];
    fieldErrors?: Record<string, string[]>;
  };
};

export const signinWithEmailFormAction = async (
  _: SigninFormActionResult,
  formData: FormData
) => {
  const validateFormData = signinSchema.safeParse({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (!validateFormData.success) {
    return {
      success: false,
      errors: validateFormData.error.flatten(),
    };
  }

  const { email, password } = validateFormData.data;

  try {
    await signinWithEmailAction({
      email,
      password,
    });

    return {
      success: true,
    };
  } catch (e) {
    return {
      success: false,
      errors: {
        formErrors: ["ログインに失敗しました。メールアドレスとパスワードを確認してください。"],
      },
    };
  }
};
