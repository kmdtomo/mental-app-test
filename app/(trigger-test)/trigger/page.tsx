"use client";

import { useState } from "react";
import {
  triggerFirstJob,
  triggerFirstScheduledTask,
  triggerHelloWorld,
  triggerSecondScheduledTask,
} from "@/actions/trigger/example";
import { Car } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export default function TriggerTestPage() {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleHelloWorld = async () => {
    try {
      setIsLoading(true);
      await triggerHelloWorld(message);
      setMessage("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFirstScheduled = async () => {
    try {
      setIsLoading(true);
      await triggerFirstScheduledTask();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSecondScheduled = async () => {
    try {
      setIsLoading(true);
      await triggerSecondScheduledTask();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="mb-6 text-2xl font-bold">Trigger.dev テスト</h1>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Hello World タスク</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Input
              placeholder="メッセージを入力"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <Button onClick={handleHelloWorld} disabled={isLoading || !message}>
              実行
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>First Job</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Button
              onClick={() => triggerFirstJob("First Job!")}
              disabled={isLoading}
            >
              First Job 実行
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>スケジュールされたタスク</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Button onClick={handleFirstScheduled} disabled={isLoading}>
              First Task 実行
            </Button>
            <Button onClick={handleSecondScheduled} disabled={isLoading}>
              Second Task 実行
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
