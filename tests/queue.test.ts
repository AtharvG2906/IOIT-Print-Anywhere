import { describe, expect, it } from "vitest";
import { describeWait, jobPages, queueInfo, type QueueJob } from "@/lib/queue";

const job = (id: string, status: QueueJob["status"], paidMin: number, pages = 4, copies = 1): QueueJob => ({
  id,
  status,
  paidAt: new Date(paidMin * 60_000),
  selectedPages: pages,
  copies,
});

describe("queueInfo", () => {
  it("counts the job printing now and jobs paid earlier, not later ones", () => {
    const printing = job("a", "PRINTING", 1, 9); // 10 sheets with cover
    const earlier = job("b", "PAID", 2, 4); // 5
    const mine = job("c", "PAID", 3, 4); // 5
    const later = job("d", "PAID", 4, 100);
    const q = queueInfo(mine, [printing, earlier, mine, later], 20);
    expect(q.peopleBefore).toBe(2);
    expect(q.printingNow).toBe(false);
    // 20 pages / 20 ppm = 1 min, + 3 jobs × 30 s = 1.5 min → 2.5 → 3 min
    expect(q.minutes).toBe(3);
  });

  it("says you're next when nothing is ahead", () => {
    const mine = job("m", "PAID", 5, 1);
    expect(queueInfo(mine, [mine], 20)).toEqual({ peopleBefore: 0, printingNow: false, minutes: 1 });
  });

  it("reports printing now for your own printing job", () => {
    const mine = job("m", "PRINTING", 5, 40, 2); // 81 sheets
    expect(queueInfo(mine, [mine], 20)).toEqual({ peopleBefore: 0, printingNow: true, minutes: 5 });
  });

  it("counts pages × copies plus a cover page", () => {
    expect(jobPages({ selectedPages: 3, copies: 2 })).toBe(7);
  });
});

describe("describeWait", () => {
  it("formats minutes and hours", () => {
    expect(describeWait(6)).toBe("about 6 min");
    expect(describeWait(60)).toBe("about 1 h");
    expect(describeWait(95)).toBe("about 1 h 35 min");
  });
});
