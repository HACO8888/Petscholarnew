"use client";
/* eslint-disable react-hooks/set-state-in-effect -- 本元件於 mount 時由 localStorage 同步初始狀態，屬合理用法 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { deleteRoom, joinRoom, leaveRoom } from "@/app/(app)/study-rooms/actions";

interface RoomInfo {
  id: string;
  name: string;
  subject: string | null;
  description: string | null;
  capacity: number;
}

interface Member {
  id: string;
  name: string;
  image: string | null;
  isSelf: boolean;
}

interface Goal {
  id: string;
  text: string;
  completed: boolean;
}

interface ChatMessage {
  id: string;
  author: string;
  text: string;
  time: string;
  isSelf: boolean;
}

interface StudyRoomDetailProps {
  room: RoomInfo;
  members: Member[];
  memberCount: number;
  meName: string;
  /** 是否可解散此自習室（建立者或系統管理員） */
  canManage: boolean;
  /** 目前使用者是否已是成員 */
  isMember: boolean;
  /** 自習室是否已滿 */
  isFull: boolean;
}

const POMO_SECONDS = 25 * 60;
const AVATARS = ["👩‍🎓", "👨‍🎓", "🐱", "🐶", "🤖"];

function nowTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StudyRoomDetail({
  room,
  members,
  memberCount,
  meName,
  canManage,
  isMember,
  isFull,
}: StudyRoomDetailProps) {
  // ---- 番茄鐘 ----
  const [timeLeft, setTimeLeft] = useState(POMO_SECONDS);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          return POMO_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  function toggleTimer() {
    setRunning((r) => !r);
  }
  function resetTimer() {
    setRunning(false);
    setTimeLeft(POMO_SECONDS);
  }

  const mins = Math.floor(timeLeft / 60)
    .toString()
    .padStart(2, "0");
  const secs = (timeLeft % 60).toString().padStart(2, "0");

  // ---- 讀書目標清單（localStorage） ----
  const goalsKey = `study-goals:${room.id}`;
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoal, setNewGoal] = useState("");
  const [goalsLoaded, setGoalsLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(goalsKey);
      if (raw) setGoals(JSON.parse(raw) as Goal[]);
    } catch {
      /* ignore */
    }
    setGoalsLoaded(true);
  }, [goalsKey]);

  useEffect(() => {
    if (!goalsLoaded) return;
    try {
      localStorage.setItem(goalsKey, JSON.stringify(goals));
    } catch {
      /* ignore */
    }
  }, [goals, goalsKey, goalsLoaded]);

  // 防連點/連按 Enter 重複送出：上鎖直到下一個動畫影格才釋放，
  // 攔住同一輸入值在 state 清空前被第二個 Enter 事件再次送出。
  const goalLockRef = useRef(false);

  function toggleGoal(id: string) {
    setGoals((gs) =>
      gs.map((g) => (g.id === id ? { ...g, completed: !g.completed } : g)),
    );
  }
  function addGoal() {
    const text = newGoal.trim();
    if (!text || goalLockRef.current) return;
    goalLockRef.current = true;
    setGoals((gs) => [
      ...gs,
      { id: `goal-${Date.now()}`, text, completed: false },
    ]);
    setNewGoal("");
    requestAnimationFrame(() => {
      goalLockRef.current = false;
    });
  }

  // ---- 聊天室（localStorage） ----
  const chatKey = `study-chat:${room.id}`;
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [chatLoaded, setChatLoaded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(chatKey);
      if (raw) setChat(JSON.parse(raw) as ChatMessage[]);
    } catch {
      /* ignore */
    }
    setChatLoaded(true);
  }, [chatKey]);

  useEffect(() => {
    if (!chatLoaded) return;
    try {
      localStorage.setItem(chatKey, JSON.stringify(chat));
    } catch {
      /* ignore */
    }
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [chat, chatKey, chatLoaded]);

  const chatLockRef = useRef(false);
  function sendMessage() {
    const text = newMsg.trim();
    if (!text || chatLockRef.current) return;
    chatLockRef.current = true;
    setChat((c) => [
      ...c,
      {
        id: `chat-${Date.now()}`,
        author: meName,
        text,
        time: nowTime(),
        isSelf: true,
      },
    ]);
    setNewMsg("");
    requestAnimationFrame(() => {
      chatLockRef.current = false;
    });
  }

  const title = room.subject || room.name;
  const remainingSlots = Math.max(0, room.capacity - members.length);

  return (
    <section id="sect-study-detail">
      <div className="flex justify-between items-start mb-md gap-4">
        <div>
          <h1 className="font-bold text-headline-lg text-on-background">
            {title}
          </h1>
          <p className="text-secondary text-body-md mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">group</span>{" "}
{memberCount} 位成員
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isMember ? (
            <form action={leaveRoom}>
              <input type="hidden" name="roomId" value={room.id} />
              <button
                type="submit"
                className="bg-surface-container-high hover:bg-surface-container-highest text-error font-bold text-body-md px-4 py-2 rounded-lg border border-outline-variant/30 shadow-sm transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span> 離開
              </button>
            </form>
          ) : isFull ? (
            <button
              type="button"
              disabled
              className="bg-surface-variant text-on-surface-variant/60 font-bold text-body-md px-4 py-2 rounded-lg border border-outline-variant/30 cursor-not-allowed flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[18px]">group_off</span> 已滿
            </button>
          ) : (
            <form action={joinRoom}>
              <input type="hidden" name="roomId" value={room.id} />
              <button
                type="submit"
                className="bg-primary hover:bg-surface-tint text-on-primary font-bold text-body-md px-4 py-2 rounded-lg shadow-sm transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[18px]">group_add</span> 加入自習室
              </button>
            </form>
          )}
          {canManage && (
            <form action={deleteRoom}>
              <input type="hidden" name="roomId" value={room.id} />
              <button
                type="submit"
                className="bg-error-container hover:opacity-90 text-on-error-container font-bold text-body-md px-4 py-2 rounded-lg border border-error/20 shadow-sm transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span> 解散
              </button>
            </form>
          )}
          <Link
            href="/study-rooms"
            className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant font-bold text-body-md px-4 py-2 rounded-lg border border-outline-variant/30 shadow-sm transition-all flex items-center gap-1 no-underline"
          >
            <span className="material-symbols-outlined">arrow_back</span> 返回列表
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
        {/* Left: 專注夥伴 */}
        <div className="lg:col-span-3 bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-xl border border-outline-variant/30 shadow-sm flex flex-col">
          <h3 className="font-bold text-body-md text-on-surface mb-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-primary">
              grid_view
            </span>{" "}
            專注夥伴
          </h3>
          <div className="grid grid-cols-2 gap-sm">
            {members.map((m, i) => (
              <div
                key={m.id}
                className="aspect-square bg-surface-container-low dark:bg-surface rounded-lg border border-outline-variant/30 flex flex-col items-center justify-center p-2 relative overflow-hidden group"
              >
                {m.image ? (
                  // 有 Google 頭像就顯示真實照片，沒有才退回 emoji 頭像
                  <img
                    alt=""
                    src={m.image}
                    className="w-10 h-10 mb-1 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-3xl mb-1">
                    {AVATARS[i % AVATARS.length]}
                  </span>
                )}
                <span className="text-[10px] font-bold text-on-surface truncate w-full text-center">
                  {m.name}
                </span>
                {m.isSelf && (
                  <span className="absolute top-1 right-1 bg-primary text-on-primary text-[8px] font-bold px-1 rounded-full">你</span>
                )}
              </div>
            ))}
            {Array.from({ length: remainingSlots }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="aspect-square bg-surface-container-lowest border border-dashed border-outline-variant/40 rounded-lg flex items-center justify-center text-outline/50"
              >
                <span className="material-symbols-outlined">add</span>
              </div>
            ))}
          </div>
        </div>

        {/* Center: 番茄鐘 */}
        <div className="lg:col-span-6 bg-surface-container-lowest dark:bg-surface-container-high p-xl rounded-xl border border-outline-variant/30 shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-container/20 rounded-full blur-3xl opacity-40" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-tertiary-container/20 rounded-full blur-3xl opacity-40" />

          <div className="text-center z-10">
            <h2 className="font-bold text-body-lg text-primary dark:text-primary-fixed mb-1">
              專注鐘 (Pomodoro)
            </h2>
            <p className="text-secondary text-xs mb-6">
              {running ? "番茄鐘運作中" : "準備開始一個番茄鐘"}
            </p>

            <div className="text-[72px] font-bold tracking-tight text-on-background leading-none mb-8 tabular-nums">
              {mins}:{secs}
            </div>

            <div className="flex gap-4 justify-center">
              <button
                type="button"
                onClick={toggleTimer}
                className="bg-primary text-on-primary hover:bg-surface-tint font-bold text-body-md px-6 py-2.5 rounded-lg shadow flex items-center gap-1 transition-all"
              >
                <span className="material-symbols-outlined">
                  {running ? "pause" : "play_arrow"}
                </span>
                <span>{running ? "暫停" : "開始"}</span>
              </button>
              <button
                type="button"
                onClick={resetTimer}
                className="bg-surface-container text-on-surface-variant font-bold text-body-md px-5 py-2.5 rounded-lg border border-outline-variant/30 hover:bg-surface-container-highest transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined">refresh</span> 重置
              </button>
            </div>
          </div>
        </div>

        {/* Right: 目標清單 + 聊天 */}
        <div className="lg:col-span-3 flex flex-col gap-md h-full">
          {/* 今日小組目標 */}
          <div className="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-xl border border-outline-variant/30 shadow-sm flex flex-col min-h-[220px]">
            <h3 className="font-bold text-body-md text-on-surface mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-tertiary">
                playlist_add_check
              </span>{" "}
              今日小組目標
            </h3>

            <div className="space-y-1.5 flex-grow overflow-y-auto max-h-[160px] pr-1">
              {goals.length === 0 ? (
                <p className="text-xs text-secondary p-1.5">尚無目標，新增一個吧！</p>
              ) : (
                goals.map((goal) => (
                  <label
                    key={goal.id}
                    className={`flex items-start gap-2 p-1.5 hover:bg-surface-container-low dark:hover:bg-surface rounded-lg cursor-pointer transition-colors group ${
                      goal.completed ? "opacity-50" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={goal.completed}
                      onChange={() => toggleGoal(goal.id)}
                      className="mt-0.5 rounded border-outline-variant text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <span
                      className={`text-xs text-on-background group-hover:text-primary transition-all ${
                        goal.completed ? "line-through" : ""
                      }`}
                    >
                      {goal.text}
                    </span>
                  </label>
                ))
              )}
            </div>

            <div className="mt-2.5 relative">
              <input
                type="text"
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                onKeyDown={(e) => {
                  // 中文 IME 用 Enter 選字時不送出；連按(repeat)也擋掉
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && !e.repeat) {
                    e.preventDefault();
                    addGoal();
                  }
                }}
                placeholder="新增目標..."
                className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant/40 rounded-lg py-1.5 pl-3 pr-8 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
              />
              <button
                type="button"
                onClick={addGoal}
                aria-label="新增目標"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-primary hover:opacity-85"
              >
                <span className="material-symbols-outlined text-[18px]">
                  add_circle
                </span>
              </button>
            </div>
          </div>

          {/* 靜音文字討論區 */}
          <div className="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-xl border border-outline-variant/30 shadow-sm flex flex-col min-h-[280px]">
            <h3 className="font-bold text-body-md text-on-surface mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-secondary">
                forum
              </span>{" "}
              專注筆記
              <span className="ml-1 text-[10px] font-normal text-secondary">（僅自己可見）</span>
            </h3>
            <div className="flex-grow overflow-y-auto text-xs space-y-2 max-h-[200px] pr-1 flex flex-col">
              <div className="text-center text-[10px] text-secondary my-1.5">
                -- 自習時的個人專注筆記，僅儲存在本機 --
              </div>
              {chat.length === 0 && (
                <div className="flex-grow flex items-center justify-center text-center text-[10px] text-secondary py-4">
                  還沒有訊息，發出第一則討論吧！
                </div>
              )}
              {chat.map((msg) =>
                msg.isSelf ? (
                  <div
                    key={msg.id}
                    className="flex flex-col items-end max-w-[85%] self-end ml-auto mb-2"
                  >
                    <span className="text-[9px] text-secondary mb-0.5 mr-1">
                      {msg.author}
                    </span>
                    <div className="bg-primary text-on-primary px-2.5 py-1.5 rounded-lg rounded-tr-none text-xs leading-normal">
                      {msg.text}
                    </div>
                  </div>
                ) : (
                  <div
                    key={msg.id}
                    className="flex flex-col items-start max-w-[85%] mb-2"
                  >
                    <span className="text-[9px] text-secondary mb-0.5 ml-1">
                      {msg.author}
                    </span>
                    <div className="bg-surface-container-low dark:bg-surface text-on-surface px-2.5 py-1.5 rounded-lg rounded-tl-none text-xs leading-normal border border-outline-variant/20">
                      {msg.text}
                    </div>
                  </div>
                ),
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-1.5 mt-2">
              <input
                type="text"
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && !e.repeat) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="輕聲輸入..."
                className="flex-grow bg-surface-container-low dark:bg-surface border border-outline-variant/40 rounded-lg py-1.5 px-3 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              />
              <button
                type="button"
                onClick={sendMessage}
                aria-label="送出訊息"
                className="bg-primary text-on-primary px-3 py-1.5 rounded-lg hover:bg-surface-tint transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">
                  send
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
