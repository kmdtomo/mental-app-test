"use server";

import { signupWithEmailAction } from "@/actions/auth/actions";
import * as z from "zod";

const signupSchema = z
  .object({
    email: z.string().email("有効なメールアドレスを入力してください"),
    fullName: z.string().min(1, "氏名は必須です"),
    password: z.string().min(6, "パスワードは6文字以上である必要があります"),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "パスワードが一致しません",
    path: ["confirm_password"],
  });

export type SignupFormActionResult = {
  success?: boolean;
  errors?: {
    formErrors?: string[];
    fieldErrors?: Record<string, string[]>;
  };
};

export const signupWithEmailFormAction = async (
  _: SignupFormActionResult,
  formData: FormData
) => {
  const validateFormData = signupSchema.safeParse({
    email: formData.get("email") as string,
    fullName: formData.get("fullName") as string,
    password: formData.get("password") as string,
    confirm_password: formData.get("confirm_password") as string,
  });

  if (!validateFormData.success) {
    console.log("error in validation", validateFormData.error.flatten());
    return {
      success: false,
      errors: validateFormData.error.flatten(),
    };
  }

  const { email, fullName, password } = validateFormData.data;

  try {
    await signupWithEmailAction({
      email,
      name: fullName,
      password,
    });

    return {
      success: true,
    };
  } catch (e) {
    console.error(e);
    return {
      success: false,
      errors: {
        formErrors: ["ユーザー登録に失敗しました。入力内容を確認してください。"],
      },
    };
  }
};
