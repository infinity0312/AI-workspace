const statuses: Record<string,string> = {
  QUEUED:'排队中',PLANNING:'规划中',RUNNING:'运行中',PAUSED:'已暂停',COMPLETED:'已完成',PARTIAL:'部分完成',FAILED:'失败',CANCELLED:'已取消',BUDGET_EXHAUSTED:'预算耗尽',
  parsed:'已解析',registered:'待解析',proposed:'待审核',confirmed:'已确认',rejected:'已拒绝',
};
export const statusLabel = (status: string) => statuses[status] ?? status;
export const activeRun = (status: string) => ['QUEUED','PLANNING','RUNNING'].includes(status);
