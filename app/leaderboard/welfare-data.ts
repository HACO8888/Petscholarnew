// 福利社優惠券設定（對齊 legacy WELFARE_ITEMS）。
// 放在非 "use server" 模組，供 page.tsx 與 actions.ts 共用
// （"use server" 檔案不可 export 非 async 的值）。

export type WelfareItem = {
  id: string;
  name: string;
  desc: string;
  icon: string;
  reqType: "level" | "badge";
  reqValue: number | string;
  couponCode: string;
};

export const WELFARE_ITEMS: WelfareItem[] = [
  {
    id: "welfare-fries",
    name: "麥當勞大薯升級券",
    desc: "北科校內麥當勞專屬！中薯免費升級大薯，考試熬夜解饞必備。",
    icon: "🍟",
    reqType: "level",
    reqValue: 4,
    couponCode: "MCD-FRIES-UP-9928",
  },
  {
    id: "welfare-boba",
    name: "連鎖手搖飲免費加珍券",
    desc: "北科正門手搖特約店！購買大杯純茶免費加蜂蜜波霸珍珠一份。",
    icon: "🧋",
    reqType: "badge",
    reqValue: "解題達人",
    couponCode: "BOBA-FREE-ADD-8812",
  },
  {
    id: "welfare-waffle",
    name: "北科周邊特約鬆餅折10元",
    desc: "校園後門特約手作鬆餅，憑此券折抵任意口味鬆餅 10 元。",
    icon: "🧇",
    reqType: "badge",
    reqValue: "好學新手",
    couponCode: "WAFFLE-OFF-10-7734",
  },
  {
    id: "welfare-study-tea",
    name: "K書中心特大杯烏龍綠茶兌換券",
    desc: "達特定成就，免費獲得大杯冰烏龍綠茶一杯，邊讀邊喝超清涼！",
    icon: "🍵",
    reqType: "level",
    reqValue: 5,
    couponCode: "OULONG-TEA-FREE-6641",
  },
];
