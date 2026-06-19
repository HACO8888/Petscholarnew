"use client";

import { useState } from "react";
import { updateRoom } from "@/app/(app)/study-rooms/actions";

interface EditableRoom {
  id: string;
  name: string;
  subject: string | null;
  description: string | null;
  capacity: number;
  hasPassword: boolean;
}

/**
 * 「編輯房間」彈窗：建立者/系統管理員可改標題/科目/說明/人數上限/密碼。
 * 密碼欄留空 = 不變更；勾「移除密碼」= 改為公開房。
 * 不回傳明碼，僅以 hasPassword 旗標提示目前是否為私密房。
 */
export default function StudyRoomEditDialog({
  room,
  memberCount,
}: {
  room: EditableRoom;
  memberCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [removePw, setRemovePw] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="編輯房間"
        className="text-on-surface-variant font-bold text-body-md px-3 py-1.5 rounded-full hover:bg-surface-container-highest transition-all flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="material-symbols-outlined text-[18px]">edit</span>
        <span className="hidden sm:inline">編輯</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <form
            action={async (fd) => {
              await updateRoom(fd);
              setOpen(false);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-[min(28rem,calc(100vw-2rem))] max-h-[90vh] overflow-y-auto bg-surface-container-lowest dark:bg-surface-container-high rounded-2xl border border-outline-variant/40 shadow-xl p-lg space-y-md"
          >
            <input type="hidden" name="roomId" value={room.id} />
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-body-lg text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  edit
                </span>
                編輯自習室
              </h3>
              <button
                type="button"
                aria-label="關閉"
                onClick={() => setOpen(false)}
                className="p-1 rounded-full text-secondary hover:text-on-surface hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div>
              <label
                htmlFor="edit-room-name"
                className="block text-sm font-bold text-secondary mb-1.5"
              >
                自習室名稱
              </label>
              <input
                id="edit-room-name"
                name="name"
                type="text"
                required
                maxLength={80}
                defaultValue={room.name}
                className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant rounded-lg py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label
                htmlFor="edit-room-subject"
                className="block text-sm font-bold text-secondary mb-1.5"
              >
                科目 / 主題（選填）
              </label>
              <input
                id="edit-room-subject"
                name="subject"
                type="text"
                maxLength={40}
                defaultValue={room.subject ?? ""}
                className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant rounded-lg py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label
                htmlFor="edit-room-description"
                className="block text-sm font-bold text-secondary mb-1.5"
              >
                說明（選填）
              </label>
              <input
                id="edit-room-description"
                name="description"
                type="text"
                maxLength={120}
                defaultValue={room.description ?? ""}
                className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant rounded-lg py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label
                htmlFor="edit-room-capacity"
                className="block text-sm font-bold text-secondary mb-1.5"
              >
                人數上限（不可低於目前 {memberCount} 人）
              </label>
              <input
                id="edit-room-capacity"
                name="capacity"
                type="number"
                min={Math.max(2, memberCount)}
                max={12}
                defaultValue={room.capacity}
                className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant rounded-lg py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label
                htmlFor="edit-room-password"
                className="block text-sm font-bold text-secondary mb-1.5"
              >
                房間密碼{" "}
                <span className="font-normal text-on-surface-variant">
                  {room.hasPassword
                    ? "（目前為私密房；留空不變更）"
                    : "（留空 = 公開房）"}
                </span>
              </label>
              <input
                id="edit-room-password"
                name="password"
                type="password"
                maxLength={64}
                disabled={removePw}
                placeholder={room.hasPassword ? "••••（不變更）" : "設定密碼…"}
                className="w-full bg-surface-container-low dark:bg-surface border border-outline-variant rounded-lg py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              />
              {room.hasPassword && (
                <label className="mt-2 flex items-center gap-2 text-sm text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    name="removePassword"
                    checked={removePw}
                    onChange={(e) => setRemovePw(e.target.checked)}
                    className="rounded border-outline-variant text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  移除密碼（改為公開房）
                </label>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="bg-surface-container text-on-surface-variant font-bold text-sm px-4 py-2 rounded-lg border border-outline-variant/30 hover:bg-surface-container-highest focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                取消
              </button>
              <button
                type="submit"
                className="bg-primary text-on-primary hover:bg-surface-tint font-bold text-sm px-4 py-2 rounded-lg shadow-sm flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                儲存
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
