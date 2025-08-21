import { schedules, task, wait } from "@trigger.dev/sdk/v3";

import { JOB_IDS, SCHEDULE_IDS } from "./constants";
import {
  printFirstJob,
  printFirstScheduledTask,
  printHelloWorld,
  printSecondScheduledTask,
} from "./jobs/test/example";

export const helloTask = task({
  id: "hello-world",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  run: async (payload: any, { ctx }) => {
    console.log("Hello, world!", { payload, ctx });

    await wait.for({ seconds: 5 });

    return {
      message: "Hello, world!",
    };
  },
});

export const helloWorldTask = task({
  id: JOB_IDS.SAMPLE_JOB,
  maxDuration: 300, // 300秒
  run: printHelloWorld,
});

export const firstJob = task({
  id: JOB_IDS.FIRST_JOB,
  maxDuration: 300, // 300秒
  run: printFirstJob,
});

export const firstScheduledTask = schedules.task({
  id: SCHEDULE_IDS.FIRST_SCHEDULED_TASK,
  cron: "0 * * * *", // 毎時
  maxDuration: 300, // 300秒
  run: printFirstScheduledTask,
});

export const secondScheduledTask = schedules.task({
  id: SCHEDULE_IDS.SECOND_SCHEDULED_TASK,
  cron: "0 * * * *", // 毎時
  maxDuration: 300, // 300秒
  run: printSecondScheduledTask,
});
