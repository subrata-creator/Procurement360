import type { Cr49f_procurementapprovalcycles } from "../generated/models/Cr49f_procurementapprovalcyclesModel";
import { Cr49f_procurementapprovalcyclesService } from "../generated/services/Cr49f_procurementapprovalcyclesService";
import { Cr49f_tasksesService } from "../generated/services/Cr49f_tasksesService";
import {
  SAMPLE_APPROVAL_CYCLES,
  type SampleApprovalCycleItem,
} from "../data/SampleApprovalCycleData";

export interface ApprovalCycleSeedingResult {
  cycles: Cr49f_procurementapprovalcycles[];
  createdTasksCount: number;
}

const cleanGuid = (id?: string): string => {
  if (!id) return "";
  return String(id).replace(/[{}]/g, "").toLowerCase().trim();
};

/**
 * Seeds approval cycles and linked tasks for PR, RFQ, and Purchase Orders (Orders)
 * Each approval cycle will have between 3 and 5 tasks.
 * Idempotent: checks for existing approval cycles and tasks to prevent duplication.
 */
export async function seedApprovalCyclesToDataverse(
  onProgress?: (status: string) => void,
  sampleList: SampleApprovalCycleItem[] = SAMPLE_APPROVAL_CYCLES
): Promise<ApprovalCycleSeedingResult> {
  const notify = (msg: string) => {
    if (onProgress) onProgress(msg);
  };

  notify("Checking existing approval cycles in Dataverse...");

  let existingCycles: Cr49f_procurementapprovalcycles[] = [];
  try {
    const res = await Cr49f_procurementapprovalcyclesService.getAll();
    if (res.data) {
      existingCycles = res.data;
      notify(`Found ${existingCycles.length} existing approval cycles in Dataverse.`);
    }
  } catch (err) {
    console.warn("Could not query existing approval cycles:", err);
  }

  let existingTasks: Array<{
    cr49f_tasksid?: string;
    cr49f_task?: string;
    cr49f_sequencenumber?: number;
    _cr49f_procurementapprovalcycle_value?: string;
  }> = [];

  try {
    const taskRes = await Cr49f_tasksesService.getAll();
    if (taskRes.data) {
      existingTasks = taskRes.data;
    }
  } catch (err) {
    console.warn("Could not query existing tasks:", err);
  }

  const processedCycles: Cr49f_procurementapprovalcycles[] = [];
  let createdTasksCount = 0;
  const total = sampleList.length;

  for (let i = 0; i < total; i++) {
    const item = sampleList[i];
    notify(`[${i + 1}/${total}] Configuring approval cycle for ${item.objectTypeName}...`);

    // Match existing cycle by object type or code
    let matchedCycle = existingCycles.find((c) => {
      const typeMatches = Number(c.cr49f_objecttype) === Number(item.objectType);
      const codeMatches =
        item.code &&
        c.cr49f_id &&
        c.cr49f_id.toLowerCase().trim() === item.code.toLowerCase().trim();
      return typeMatches || codeMatches;
    });

    if (!matchedCycle) {
      notify(`Creating approval cycle for "${item.objectTypeName}"...`);

      const payload = {
        cr49f_objecttype: item.objectType,
        cr49f_id: item.code,
        statecode: 0 as const,
        statuscode: 1 as const,
      };

      let createRes = await Cr49f_procurementapprovalcyclesService.create(
        payload as Parameters<typeof Cr49f_procurementapprovalcyclesService.create>[0]
      );

      // In case cr49f_id is rejected by schema, retry without it
      if (!createRes.data) {
        try {
          const fallbackPayload = {
            cr49f_objecttype: item.objectType,
            statecode: 0 as const,
            statuscode: 1 as const,
          };
          createRes = await Cr49f_procurementapprovalcyclesService.create(
            fallbackPayload as Parameters<typeof Cr49f_procurementapprovalcyclesService.create>[0]
          );
        } catch {
          // Keep original error handling
        }
      }

      if (!createRes.data) {
        throw new Error(
          createRes.error?.message ||
            `Failed to create approval cycle for "${item.objectTypeName}" in Dataverse.`
        );
      }

      matchedCycle = createRes.data;
      existingCycles.push(matchedCycle);
    } else {
      notify(`Approval cycle for "${item.objectTypeName}" already exists in Dataverse.`);
    }

    processedCycles.push(matchedCycle);
    const cycleId = cleanGuid(matchedCycle.cr49f_procurementapprovalcycleid);
    if (!cycleId) continue;

    // Filter existing tasks belonging to this cycle
    const currentCycleTasks = existingTasks.filter(
      (t) => cleanGuid(t._cr49f_procurementapprovalcycle_value) === cycleId
    );

    // Create missing tasks (ensures min 3 and max 5 tasks)
    for (let tIdx = 0; tIdx < item.tasks.length; tIdx++) {
      const t = item.tasks[tIdx];
      const targetSeq = t.cr49f_sequencenumber;
      const targetTask = t.cr49f_task.toLowerCase().trim();

      const taskExists = currentCycleTasks.some((ct) => {
        const seqMatch = ct.cr49f_sequencenumber === targetSeq;
        const nameMatch =
          ct.cr49f_task && ct.cr49f_task.toLowerCase().trim() === targetTask;
        return seqMatch || nameMatch;
      });

      if (!taskExists) {
        notify(
          `[${i + 1}/${total}] Adding task (${tIdx + 1}/${item.tasks.length}): "${t.cr49f_task}"...`
        );

        const taskPayload = {
          "cr49f_ProcurementApprovalCycle@odata.bind": `/cr49f_procurementapprovalcycles(${cycleId})`,
          cr49f_task: t.cr49f_task.slice(0, 95),
          cr49f_role: t.cr49f_role,
          cr49f_department: t.cr49f_department,
          cr49f_sequencenumber: t.cr49f_sequencenumber,
          cr49f_slanumber: t.cr49f_slanumber,
          cr49f_slaunit: t.cr49f_slaunit,
          statecode: 0 as const,
          statuscode: 1 as const,
        };

        const taskRes = await Cr49f_tasksesService.create(
          taskPayload as Parameters<typeof Cr49f_tasksesService.create>[0]
        );

        if (taskRes.data) {
          createdTasksCount++;
          currentCycleTasks.push({
            cr49f_tasksid: taskRes.data.cr49f_tasksid,
            cr49f_task: taskRes.data.cr49f_task,
            cr49f_sequencenumber: taskRes.data.cr49f_sequencenumber,
            _cr49f_procurementapprovalcycle_value: cycleId,
          });
        }
      }
    }
  }

  notify(
    `Completed! ${processedCycles.length} approval cycles verified (${createdTasksCount} new tasks created).`
  );

  return {
    cycles: processedCycles,
    createdTasksCount,
  };
}

