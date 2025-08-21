"use server";

import {
  firstJob,
  firstScheduledTask,
  helloWorldTask,
  secondScheduledTask,
} from "@/trigger";
import { SCHEDULE_IDS } from "@/trigger/constants";
import { type Message } from "@/types";

export const triggerHelloWorld = async (message: string) => {
  const secretKey = process.env.TRIGGER_SECRET_KEY;
  if (!secretKey) {
    throw new Error("TRIGGER_SECRET_KEY is not set");
  }
  console.log("secretKey", secretKey);
  await helloWorldTask.trigger({
    message: message ?? "Hello, world!",
  } satisfies Message);
};

export const triggerFirstJob = async (message: string) => {
  const secretKey = process.env.TRIGGER_SECRET_KEY;
  if (!secretKey) {
    throw new Error("TRIGGER_SECRET_KEY is not set");
  }
  console.log("secretKey", secretKey);
  await firstJob.trigger({
    message: message ?? "First Job!",
  } satisfies Message);
};

export const triggerFirstScheduledTask = async () => {
  const secretKey = process.env.TRIGGER_SECRET_KEY;
  if (!secretKey) {
    throw new Error("TRIGGER_SECRET_KEY is not set");
  }
  console.log("secretKey", secretKey);
  await firstScheduledTask.trigger({
    type: "IMPERATIVE",
    timestamp: new Date(),
    timezone: "Asia/Tokyo",
    scheduleId: SCHEDULE_IDS.FIRST_SCHEDULED_TASK,
    upcoming: [],
  });
};

export const triggerSecondScheduledTask = async () => {
  const secretKey = process.env.TRIGGER_SECRET_KEY;
  if (!secretKey) {
    throw new Error("TRIGGER_SECRET_KEY is not set");
  }
  console.log("secretKey", secretKey);
  await secondScheduledTask.trigger({
    type: "IMPERATIVE",
    timestamp: new Date(),
    timezone: "Asia/Tokyo",
    scheduleId: SCHEDULE_IDS.SECOND_SCHEDULED_TASK,
    upcoming: [],
  });
};

// test
