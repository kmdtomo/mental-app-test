import { type Message } from "@/types";
import { Context, wait } from "@trigger.dev/sdk/v3";

export const printHelloWorld = async (
  payload: Message,
  { ctx }: { ctx: Context }
) => {
  console.log("Processing hello world task", { payload, ctx });

  await wait.for({ seconds: 3 });

  return {
    message: payload.message ?? "Default hello world message",
  };
};

export const printFirstJob = async (
  payload: Message,
  { ctx }: { ctx: Context }
) => {
  console.log("First job", { payload, ctx });
  // 例えば、fileを受け取って、openaiのassistantに渡し、その結果をsupabaseに保存する
  return {
    message: payload.message ?? "Default hello world message",
  };
};

export const printFirstScheduledTask = async (
  payload: any,
  { ctx }: { ctx: Context }
) => {
  console.log("First scheduled tasks", { payload, ctx });

  await wait.for({ seconds: 3 });

  return {
    message: "Hello, world!",
  };
};

export const printSecondScheduledTask = async (
  payload: any,
  { ctx }: { ctx: Context }
) => {
  console.log("Second scheduled tasks", { payload, ctx });

  await wait.for({ seconds: 3 });

  return {
    message: "Hello, world!",
  };
};
