import { Cr49f_approvaltasksesService } from "../generated/services/Cr49f_approvaltasksesService";
import { Cr49f_procurementapprovalcyclesService } from "../generated/services/Cr49f_procurementapprovalcyclesService";
import { Cr49f_tasksesService } from "../generated/services/Cr49f_tasksesService";
import { Cr49f_purchaserequestsService } from "../generated/services/Cr49f_purchaserequestsService";
import { Cr49f_requestforqoutationsService } from "../generated/services/Cr49f_requestforqoutationsService";
import type { Cr49f_approvaltaskses } from "../generated/models/Cr49f_approvaltasksesModel";
import {
  Cr49f_approvaltasksescr49f_department,
  Cr49f_approvaltasksescr49f_object,
  Cr49f_approvaltasksescr49f_role,
  Cr49f_approvaltasksescr49f_slaunit,
} from "../generated/models/Cr49f_approvaltasksesModel";
import { SAMPLE_APPROVAL_CYCLES } from "../data/SampleApprovalCycleData";

export const cleanGuid = (id?: string | null): string => {
  if (!id) return "";
  const str = String(id).toLowerCase().trim();
  const match = str.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  return match ? match[0] : str.replace(/[{}]/g, "");
};

export interface CreateApprovalTasksParams {
  objectType: 1 | 2 | 3; // 1: Purchase Request, 2: RFQ, 3: Orders (PO)
  recordId: string;
  recordName?: string;
}

interface StatusStrategy {
  fieldName: string | null;
  pendingVal: unknown;
  approvedVal: unknown;
  rejectedVal: unknown;
  label: string;
}

// Candidates for tracking approval status on cr49f_approvaltasks:
// 1. Picklist 0: Pending, 1: Approved, 2: Rejected
// 2. Picklist 1: Pending, 2: Approved, 3: Rejected
// 3. Text field: "Pending", "Approved", "Rejected"
// 4. Fallback: Base record only (no custom field on table)
const STATUS_CANDIDATES: StatusStrategy[] = [
  {
    fieldName: "cr49f_approvalstatus",
    pendingVal: 0,
    approvedVal: 1,
    rejectedVal: 2,
    label: "cr49f_approvalstatus (Picklist 0=Pending, 1=Approved, 2=Rejected)",
  },
  {
    fieldName: "cr49f_approvalstatus",
    pendingVal: "Pending",
    approvedVal: "Approved",
    rejectedVal: "Rejected",
    label: "cr49f_approvalstatus (Text string)",
  },
  {
    fieldName: "cr49f_status",
    pendingVal: 0,
    approvedVal: 1,
    rejectedVal: 2,
    label: "cr49f_status (Picklist 0, 1, 2)",
  },
  {
    fieldName: null,
    pendingVal: null,
    approvedVal: null,
    rejectedVal: null,
    label: "Standard schema only (no custom status field)",
  },
];

let workingStrategy: StatusStrategy | null = null;

/**
 * Creates associated approval tasks on table `cr49f_approvaltasks` for a created PR, RFQ, or PO.
 * - Tasks are fetched from template tasks on `cr49f_tasks` (linked to the active approval cycle).
 * - All tasks are created on `cr49f_approvaltasks`.
 * - The first task (sequence 1) remains Active (`statecode: 0, statuscode: 1`).
 * - All subsequent tasks are immediately deactivated (`statecode: 1, statuscode: 2`).
 * - Employs resilient multi-strategy discovery for the approval status field so that
 *   Dataverse schema variations (Choice vs Text vs custom column) never block creation.
 */
export async function createApprovalTasksForObject(
  params: CreateApprovalTasksParams
): Promise<Cr49f_approvaltaskses[]> {
  const cleanId = cleanGuid(params.recordId);
  if (!cleanId) throw new Error("Invalid record ID");

  console.log(`[ApprovalWorkflow] Starting approval tasks creation for objectType=${params.objectType}, recordId=${cleanId}`);

  // Step 1: Query template tasks dynamically from cr49f_tasks in Dataverse
  interface NormalizedTemplateTask {
    cr49f_task: string;
    cr49f_role: number;
    cr49f_department: number;
    cr49f_sequencenumber: number;
    cr49f_slanumber: number;
    cr49f_slaunit: number;
  }

  let templateTasks: NormalizedTemplateTask[] = [];

  try {
    const [taskRes, cycleRes] = await Promise.allSettled([
      Cr49f_tasksesService.getAll(),
      Cr49f_procurementapprovalcyclesService.getAll(),
    ]);

    const allDbTasks =
      taskRes.status === "fulfilled" && taskRes.value.data ? taskRes.value.data : [];
    const allDbCycles =
      cycleRes.status === "fulfilled" && cycleRes.value.data ? cycleRes.value.data : [];

    console.log(`[ApprovalWorkflow] Fetched ${allDbTasks.length} tasks from cr49f_tasks, ${allDbCycles.length} approval cycles`);

    if (allDbTasks.length > 0) {
      // Find matching cycle for this objectType if available
      const activeCycle = allDbCycles.find((c) => {
        const matchesType =
          Number(c.cr49f_objecttype) === params.objectType ||
          (params.objectType === 1 && String(c.cr49f_objecttypename || "").toLowerCase().includes("request")) ||
          (params.objectType === 2 && String(c.cr49f_objecttypename || "").toLowerCase().includes("rfq")) ||
          (params.objectType === 3 && String(c.cr49f_objecttypename || "").toLowerCase().includes("order"));
        const isActive = c.statecode === 0 || c.statecode === undefined;
        return matchesType && isActive;
      });

      const cycleId = activeCycle ? cleanGuid(activeCycle.cr49f_procurementapprovalcycleid) : null;

      // Filter tasks by cycle if cycleId exists
      let matchedTasks = cycleId
        ? allDbTasks.filter((t) => {
            const raw = t as unknown as Record<string, unknown>;
            const tCycleId =
              cleanGuid(t._cr49f_procurementapprovalcycle_value) ||
              cleanGuid(raw._cr49f_ProcurementApprovalCycle_value as string) ||
              cleanGuid(raw.cr49f_procurementapprovalcycle as string) ||
              cleanGuid(raw.cr49f_ProcurementApprovalCycle as string);
            const isMatch = tCycleId === cycleId;
            const isActive = t.statecode === 0 || t.statecode === undefined;
            return isMatch && isActive;
          })
        : [];

      // If no tasks matched by cycle lookup, use all active tasks from cr49f_tasks directly
      if (matchedTasks.length === 0) {
        matchedTasks = allDbTasks.filter((t) => t.statecode === 0 || t.statecode === undefined);
        console.log(`[ApprovalWorkflow] Using ${matchedTasks.length} active tasks directly from cr49f_tasks`);
      }

      if (matchedTasks.length > 0) {
        templateTasks = matchedTasks.map((t) => ({
          cr49f_task: t.cr49f_task || "Approval Task",
          cr49f_role: Number(t.cr49f_role) || 2,
          cr49f_department: Number(t.cr49f_department) || 1,
          cr49f_sequencenumber: Number(t.cr49f_sequencenumber) || 1,
          cr49f_slanumber: Number(t.cr49f_slanumber) || 24,
          cr49f_slaunit: Number(t.cr49f_slaunit) || 1,
        }));
      }
    }
  } catch (err) {
    console.warn("[ApprovalWorkflow] Could not query tasks dynamically from Dataverse cr49f_tasks:", err);
  }

  // Fallback to sample definition ONLY if Dataverse cr49f_tasks has no records at all
  if (templateTasks.length === 0) {
    console.log(`[ApprovalWorkflow] Using sample approval cycle fallback for objectType=${params.objectType}`);
    const sampleCycle = SAMPLE_APPROVAL_CYCLES.find(
      (c) => c.objectType === params.objectType
    );
    if (sampleCycle) {
      templateTasks = sampleCycle.tasks.map((t) => ({
        cr49f_task: t.cr49f_task,
        cr49f_role: Number(t.cr49f_role),
        cr49f_department: Number(t.cr49f_department),
        cr49f_sequencenumber: t.cr49f_sequencenumber,
        cr49f_slanumber: t.cr49f_slanumber,
        cr49f_slaunit: Number(t.cr49f_slaunit),
      }));
    }
  }

  // Sort ascending by sequence number
  templateTasks.sort((a, b) => a.cr49f_sequencenumber - b.cr49f_sequencenumber);

  // Set lookup binding for the parent object
  const parentBinding: Record<string, string> = {};
  if (params.objectType === 1) {
    parentBinding["cr49f_PR@odata.bind"] = `/cr49f_purchaserequests(${cleanId})`;
  } else if (params.objectType === 2) {
    parentBinding["cr49f_RFQ@odata.bind"] = `/cr49f_requestforqoutations(${cleanId})`;
  } else if (params.objectType === 3) {
    parentBinding["cr49f_PO@odata.bind"] = `/cr49f_purchaserequests(${cleanId})`;
  }

  // Step 3: Create associated tasks on cr49f_approvaltasks
  const createdApprovalTasks: Cr49f_approvaltaskses[] = [];
  let lastErrorDetail = "";

  for (let i = 0; i < templateTasks.length; i++) {
    const t = templateTasks[i];
    const isFirstTask = i === 0;

    const safeSlaUnit = (
      t.cr49f_slaunit > 4 ? 4 : t.cr49f_slaunit
    ) as keyof typeof Cr49f_approvaltasksescr49f_slaunit;

    const taskTitle = t.cr49f_task.trim() || `Approval Task ${i + 1}`;
    const taskNameTruncated = taskTitle.slice(0, 95);

    // Base payload with standard schema fields
    // NOTE: cr49f_id is auto-generated by Dataverse; do NOT send or update cr49f_id
    const basePayload: Record<string, unknown> = {
      cr49f_task: taskNameTruncated,
      cr49f_object: params.objectType as keyof typeof Cr49f_approvaltasksescr49f_object,
      cr49f_sequence: t.cr49f_sequencenumber || i + 1,
      cr49f_department: (t.cr49f_department || 1) as keyof typeof Cr49f_approvaltasksescr49f_department,
      cr49f_role: (t.cr49f_role || 2) as keyof typeof Cr49f_approvaltasksescr49f_role,
      cr49f_slanumber: t.cr49f_slanumber || 24,
      cr49f_slaunit: safeSlaUnit,
      ...parentBinding,
    };

    // Resilient creation with adaptive status candidate matching
    let createdRecord: Cr49f_approvaltaskses | null = null;

    const candidatesToTry = workingStrategy
      ? [workingStrategy]
      : STATUS_CANDIDATES;

    for (const strategy of candidatesToTry) {
      const payload: Record<string, unknown> = { ...basePayload };
      if (strategy.fieldName && strategy.pendingVal !== null) {
        payload[strategy.fieldName] = strategy.pendingVal;
      }

      try {
        console.log(`[ApprovalWorkflow] Attempting creation of task ${i + 1} with strategy: ${strategy.label}`);
        const res = await Cr49f_approvaltasksesService.create(
          payload as Parameters<typeof Cr49f_approvaltasksesService.create>[0]
        );

        if (res.data) {
          createdRecord = res.data;
          workingStrategy = strategy; // Lock in the working strategy for all tasks
          console.log(`[ApprovalWorkflow] Successfully created task ${i + 1} using strategy: ${strategy.label}`);
          break;
        } else if (res.error) {
          lastErrorDetail = res.error.message || JSON.stringify(res.error);
          console.warn(`[ApprovalWorkflow] Strategy "${strategy.label}" failed for task ${i + 1}:`, lastErrorDetail);
        }
      } catch (callErr: unknown) {
        lastErrorDetail = callErr instanceof Error ? callErr.message : String(callErr);
        console.warn(`[ApprovalWorkflow] Strategy "${strategy.label}" exception for task ${i + 1}:`, lastErrorDetail);
      }
    }

    // If all custom status strategies failed, attempt one final attempt with pure minimal payload
    if (!createdRecord) {
      try {
        console.log(`[ApprovalWorkflow] Trying minimal fallback creation for task ${i + 1}`);
        const fallbackRes = await Cr49f_approvaltasksesService.create(
          basePayload as Parameters<typeof Cr49f_approvaltasksesService.create>[0]
        );
        if (fallbackRes.data) {
          createdRecord = fallbackRes.data;
          workingStrategy = STATUS_CANDIDATES[STATUS_CANDIDATES.length - 1]; // minimal fallback
        } else if (fallbackRes.error) {
          lastErrorDetail = fallbackRes.error.message || JSON.stringify(fallbackRes.error);
        }
      } catch (fbErr: unknown) {
        lastErrorDetail = fbErr instanceof Error ? fbErr.message : String(fbErr);
      }
    }

    if (!createdRecord) {
      console.error(`[ApprovalWorkflow] Could not create task ${i + 1}. Last error: ${lastErrorDetail}`);
      continue;
    }

    // For tasks after sequence 1, immediately deactivate them in Dataverse (statecode: 1, statuscode: 2)
    const newTaskId = cleanGuid(
      createdRecord.cr49f_approvaltasksid ||
      (createdRecord as unknown as Record<string, string>).cr49f_ApprovalTasksId
    );

    if (!isFirstTask && newTaskId) {
      try {
        const deactRes = await Cr49f_approvaltasksesService.update(newTaskId, {
          statecode: 1 as const, // Inactive
          statuscode: 2 as const, // Inactive
        });
        if (deactRes.data) {
          createdRecord = deactRes.data;
        }
      } catch (deactErr) {
        console.warn(`[ApprovalWorkflow] Could not deactivate subsequent task ${i + 1}:`, deactErr);
      }
    }

    createdApprovalTasks.push(createdRecord);
  }

  if (createdApprovalTasks.length === 0) {
    throw new Error(
      `Could not create approval tasks on cr49f_approvaltasks. Dataverse reported: ${lastErrorDetail || "Unknown error"}`
    );
  }

  console.log(`[ApprovalWorkflow] Successfully created ${createdApprovalTasks.length} tasks on cr49f_approvaltasks!`);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("approvalTasksUpdated"));
  return createdApprovalTasks;
}

/**
 * Approves a task:
 * 1. Sets approval status to Approved on the current task.
 * 2. Finds the next task in sequence and activates it (statecode: 0, statuscode: 1).
 * 3. If no further tasks remain, marks the parent PR/RFQ/PO record as Approved (1)!
 */
export async function approveTask(approvalTaskId: string): Promise<{
  updatedTask: Cr49f_approvaltaskses;
  nextActivatedTask: Cr49f_approvaltaskses | null;
  parentCompleted: boolean;
}> {
  const cleanTaskId = cleanGuid(approvalTaskId);
  if (!cleanTaskId) throw new Error("Invalid approval task ID");

  // Determine payload based on detected working strategy
  // NOTE: Do not touch cr49f_id - it is an auto-generated field in Dataverse!
  const updatePayload: Record<string, unknown> = {
    statecode: 0,
    statuscode: 1,
  };

  if (workingStrategy?.fieldName && workingStrategy.approvedVal !== null) {
    updatePayload[workingStrategy.fieldName] = workingStrategy.approvedVal;
  } else {
    updatePayload.cr49f_approvalstatus = 1;
  }

  let updateRes = await Cr49f_approvaltasksesService.update(cleanTaskId, updatePayload);

  // If failed with custom field, fallback to updating status only (without touching cr49f_id)
  if (!updateRes.data) {
    delete updatePayload.cr49f_approvalstatus;
    updateRes = await Cr49f_approvaltasksesService.update(cleanTaskId, updatePayload);
  }

  if (!updateRes.data) {
    throw new Error(updateRes.error?.message || "Failed to update task to Approved");
  }

  const currentTask = updateRes.data;
  const currentSeq = currentTask.cr49f_sequence ?? 1;

  // Step 2: Fetch all sibling tasks for this same parent record
  const allTasksRes = await Cr49f_approvaltasksesService.getAll();
  const allTasks = allTasksRes.data ?? [];

  const rawCurrent = currentTask as unknown as Record<string, unknown>;
  const parentPR = cleanGuid(currentTask._cr49f_pr_value) || cleanGuid(rawCurrent._cr49f_PR_value as string);
  const parentRFQ = cleanGuid(currentTask._cr49f_rfq_value) || cleanGuid(rawCurrent._cr49f_RFQ_value as string);
  const parentPO = cleanGuid(currentTask._cr49f_po_value) || cleanGuid(rawCurrent._cr49f_PO_value as string);

  const siblingTasks = allTasks.filter((t) => {
    const raw = t as unknown as Record<string, unknown>;
    const tPR = cleanGuid(t._cr49f_pr_value) || cleanGuid(raw._cr49f_PR_value as string);
    const tRFQ = cleanGuid(t._cr49f_rfq_value) || cleanGuid(raw._cr49f_RFQ_value as string);
    const tPO = cleanGuid(t._cr49f_po_value) || cleanGuid(raw._cr49f_PO_value as string);

    if (parentPR && tPR === parentPR) return true;
    if (parentRFQ && tRFQ === parentRFQ) return true;
    if (parentPO && tPO === parentPO) return true;
    return false;
  });

  // Step 3: Find next task with sequence > currentSeq sorted ascending
  const remainingTasks = siblingTasks
    .filter((t) => (t.cr49f_sequence ?? 0) > currentSeq)
    .sort((a, b) => (a.cr49f_sequence ?? 0) - (b.cr49f_sequence ?? 0));

  let nextActivatedTask: Cr49f_approvaltaskses | null = null;
  let parentCompleted = false;

  if (remainingTasks.length > 0) {
    const nextTask = remainingTasks[0];
    const nextId = cleanGuid(
      nextTask.cr49f_approvaltasksid ||
      (nextTask as unknown as Record<string, string>).cr49f_ApprovalTasksId
    );
    if (nextId) {
      // Activate the next sequential task (statecode: 0, statuscode: 1)
      const activatePayload: Record<string, unknown> = {
        statecode: 0, // Active
        statuscode: 1, // Active
      };
      if (workingStrategy?.fieldName && workingStrategy.pendingVal !== null) {
        activatePayload[workingStrategy.fieldName] = workingStrategy.pendingVal;
      }
      const activateRes = await Cr49f_approvaltasksesService.update(nextId, activatePayload);
      if (activateRes.data) {
        nextActivatedTask = activateRes.data;
      }
    }
  } else {
    // All tasks in the approval cycle have been approved!
    parentCompleted = true;
    if (parentPR) {
      try {
        await Cr49f_purchaserequestsService.update(parentPR, { cr49f_status: 1 }); // 1 = Approved
      } catch (prErr) {
        console.warn("[ApprovalWorkflow] Could not update parent PR to Approved:", prErr);
      }
    } else if (parentRFQ) {
      try {
        await Cr49f_requestforqoutationsService.update(parentRFQ, { cr49f_status: 1 }); // 1 = Approved
      } catch (rfqErr) {
        console.warn("[ApprovalWorkflow] Could not update parent RFQ to Approved:", rfqErr);
      }
    }
  }

  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("approvalTasksUpdated"));
  return {
    updatedTask: currentTask,
    nextActivatedTask,
    parentCompleted,
  };
}

/**
 * Rejects a task:
 * 1. Sets approval status to Rejected on the current task.
 * 2. Leaves all further tasks inactive.
 * 3. Marks the parent PR/RFQ/PO record as Rejected (3)!
 */
export async function rejectTask(approvalTaskId: string): Promise<{
  rejectedTask: Cr49f_approvaltaskses;
  parentRejected: boolean;
}> {
  const cleanTaskId = cleanGuid(approvalTaskId);
  if (!cleanTaskId) throw new Error("Invalid approval task ID");

  const updatePayload: Record<string, unknown> = {
    statecode: 0,
    statuscode: 1,
  };

  if (workingStrategy?.fieldName && workingStrategy.rejectedVal !== null) {
    updatePayload[workingStrategy.fieldName] = workingStrategy.rejectedVal;
  } else {
    updatePayload.cr49f_approvalstatus = 2;
  }

  let updateRes = await Cr49f_approvaltasksesService.update(cleanTaskId, updatePayload);
  if (!updateRes.data) {
    delete updatePayload.cr49f_approvalstatus;
    updateRes = await Cr49f_approvaltasksesService.update(cleanTaskId, updatePayload);
  }

  if (!updateRes.data) {
    throw new Error(updateRes.error?.message || "Failed to update task to Rejected");
  }

  const currentTask = updateRes.data;
  const rawCurrent = currentTask as unknown as Record<string, unknown>;
  const parentPR = cleanGuid(currentTask._cr49f_pr_value) || cleanGuid(rawCurrent._cr49f_PR_value as string);
  const parentRFQ = cleanGuid(currentTask._cr49f_rfq_value) || cleanGuid(rawCurrent._cr49f_RFQ_value as string);

  // Update parent record to Rejected (3 for PR, 3 for RFQ)
  if (parentPR) {
    try {
      await Cr49f_purchaserequestsService.update(parentPR, { cr49f_status: 3 }); // 3 = Rejected
    } catch (prErr) {
      console.warn("[ApprovalWorkflow] Could not update parent PR to Rejected:", prErr);
    }
  } else if (parentRFQ) {
    try {
      await Cr49f_requestforqoutationsService.update(parentRFQ, { cr49f_status: 3 }); // 3 = Rejected
    } catch (rfqErr) {
      console.warn("[ApprovalWorkflow] Could not update parent RFQ to Rejected:", rfqErr);
    }
  }

  return {
    rejectedTask: currentTask,
    parentRejected: true,
  };
}

/**
 * Retrieves all approval tasks for a given PR, RFQ, or PO sorted by sequence.
 * Uses comprehensive lookup resolution to match uppercase and lowercase Dataverse property names.
 */
export async function getApprovalTasksForRecord(
  objectType: 1 | 2 | 3,
  recordId: string
): Promise<Cr49f_approvaltaskses[]> {
  const cleanId = cleanGuid(recordId);
  if (!cleanId) return [];

  try {
    const res = await Cr49f_approvaltasksesService.getAll();
    const allTasks = res.data ?? [];

    const matched = allTasks.filter((t) => {
      const raw = t as unknown as Record<string, unknown>;
      const prVal =
        cleanGuid(t._cr49f_pr_value) ||
        cleanGuid(raw._cr49f_PR_value as string) ||
        cleanGuid(raw.cr49f_pr as string) ||
        cleanGuid(raw.cr49f_PR as string);

      const rfqVal =
        cleanGuid(t._cr49f_rfq_value) ||
        cleanGuid(raw._cr49f_RFQ_value as string) ||
        cleanGuid(raw.cr49f_rfq as string) ||
        cleanGuid(raw.cr49f_RFQ as string);

      const poVal =
        cleanGuid(t._cr49f_po_value) ||
        cleanGuid(raw._cr49f_PO_value as string) ||
        cleanGuid(raw.cr49f_po as string) ||
        cleanGuid(raw.cr49f_PO as string);

      if (objectType === 1) {
        if (prVal === cleanId) return true;
        // Deep scan for any property holding the PR ID
        for (const [key, val] of Object.entries(raw)) {
          if (
            key.toLowerCase().includes("pr") &&
            typeof val === "string" &&
            cleanGuid(val) === cleanId
          ) {
            return true;
          }
        }
      } else if (objectType === 2) {
        if (rfqVal === cleanId) return true;
        for (const [key, val] of Object.entries(raw)) {
          if (
            key.toLowerCase().includes("rfq") &&
            typeof val === "string" &&
            cleanGuid(val) === cleanId
          ) {
            return true;
          }
        }
      } else if (objectType === 3) {
        if (poVal === cleanId) return true;
        for (const [key, val] of Object.entries(raw)) {
          if (
            key.toLowerCase().includes("po") &&
            typeof val === "string" &&
            cleanGuid(val) === cleanId
          ) {
            return true;
          }
        }
      }
      return false;
    });

    matched.sort((a, b) => (a.cr49f_sequence ?? 0) - (b.cr49f_sequence ?? 0));
    return matched;
  } catch (err) {
    console.error("[ApprovalWorkflow] Failed to query approval tasks for record:", err);
    return [];
  }
}

/**
 * Helper to get the human-readable approval status string for a task.
 * Handles both the dedicated cr49f_approvalstatus picklist field, text string, and legacy cr49f_id.
 */
export function getTaskApprovalStatusLabel(
  task: Cr49f_approvaltaskses
): "Pending" | "Approved" | "Rejected" {
  const raw = task as unknown as Record<string, unknown>;

  // 1. Check formatted OData string or virtual display name field (most authoritative from Dataverse)
  const formattedVal =
    (raw["cr49f_approvalstatus@OData.Community.Display.V1.FormattedValue"] as string) ||
    (raw["cr49f_approvalstatusname"] as string) ||
    (raw["_cr49f_approvalstatus_value@OData.Community.Display.V1.FormattedValue"] as string);

  if (formattedVal && typeof formattedVal === "string") {
    const fStr = formattedVal.trim().toLowerCase();
    if (fStr.includes("approv")) return "Approved";
    if (fStr.includes("reject")) return "Rejected";
    if (fStr.includes("pend")) return "Pending";
  }

  // 2. Check cr49f_approvalstatus value
  const statusVal = task.cr49f_approvalstatus ?? raw.cr49f_ApprovalStatus;
  if (statusVal !== undefined && statusVal !== null) {
    if (typeof statusVal === "string") {
      const s = statusVal.trim().toLowerCase();
      if (s.includes("approv")) return "Approved";
      if (s.includes("reject")) return "Rejected";
      if (s.includes("pend")) return "Pending";
    }

    if (typeof statusVal === "number") {
      // In official Dataverse schema: 0 = Pending, 1 = Approved, 2 = Rejected
      if (statusVal === 0) return "Pending";
      if (statusVal === 1) return "Approved";
      if (statusVal === 2) return "Rejected";
    }
  }

  // 3. Fallback to cr49f_id ONLY if explicitly string "Approved" or "Rejected"
  if (task.cr49f_id === "Approved") return "Approved";
  if (task.cr49f_id === "Rejected") return "Rejected";

  // 4. Default: any task not explicitly approved or rejected is Pending!
  return "Pending";
}

/**
 * Scans all existing PRs and RFQs in Dataverse, and if any record has zero approval tasks,
 * it creates the full set of sequential approval tasks on cr49f_approvaltasks for it.
 */
export async function syncAllPendingApprovalTasks(
  onProgress?: (status: string) => void
): Promise<{ prCount: number; rfqCount: number; tasksCreated: number }> {
  let tasksCreated = 0;
  let prCount = 0;
  let rfqCount = 0;

  const notify = (msg: string) => {
    if (onProgress) onProgress(msg);
  };

  notify("Checking existing PRs, RFQs, and approval tasks...");

  try {
    const [allTasksRes, prsRes, rfqsRes] = await Promise.all([
      Cr49f_approvaltasksesService.getAll(),
      Cr49f_purchaserequestsService.getAll(),
      Cr49f_requestforqoutationsService.getAll(),
    ]);

    const existingTasks = allTasksRes.data ?? [];
    const prs = prsRes.data ?? [];
    const rfqs = rfqsRes.data ?? [];

    // Sync for PRs
    for (const pr of prs) {
      const prId = cleanGuid(pr.cr49f_purchaserequestid);
      if (!prId) continue;

      const hasTasks = existingTasks.some((t) => {
        const raw = t as unknown as Record<string, unknown>;
        const tPR = cleanGuid(t._cr49f_pr_value) || cleanGuid(raw._cr49f_PR_value as string);
        return tPR === prId;
      });

      if (!hasTasks) {
        notify(`Creating approval tasks for PR "${pr.cr49f_prtitle || prId}"...`);
        try {
          const created = await createApprovalTasksForObject({
            objectType: 1,
            recordId: prId,
            recordName: pr.cr49f_prtitle,
          });
          tasksCreated += created.length;
          prCount++;
        } catch (prTaskErr) {
          console.warn(`Could not sync tasks for PR ${prId}:`, prTaskErr);
        }
      }
    }

    // Sync for RFQs
    for (const rfq of rfqs) {
      const rfqId = cleanGuid(rfq.cr49f_requestforqoutationid);
      if (!rfqId) continue;

      const hasTasks = existingTasks.some((t) => {
        const raw = t as unknown as Record<string, unknown>;
        const tRFQ = cleanGuid(t._cr49f_rfq_value) || cleanGuid(raw._cr49f_RFQ_value as string);
        return tRFQ === rfqId;
      });

      if (!hasTasks) {
        notify(`Creating approval tasks for RFQ "${rfq.cr49f_rfqtitle || rfqId}"...`);
        try {
          const created = await createApprovalTasksForObject({
            objectType: 2,
            recordId: rfqId,
            recordName: rfq.cr49f_rfqtitle,
          });
          tasksCreated += created.length;
          rfqCount++;
        } catch (rfqTaskErr) {
          console.warn(`Could not sync tasks for RFQ ${rfqId}:`, rfqTaskErr);
        }
      }
    }

    notify(`Completed sync! Generated ${tasksCreated} tasks across ${prCount} PRs and ${rfqCount} RFQs.`);
  } catch (err) {
    console.error("[ApprovalWorkflow] Error syncing approval tasks:", err);
  }

  return { prCount, rfqCount, tasksCreated };
}

// Global browser window helper for testing & runtime execution
if (typeof window !== "undefined") {
  (window as unknown as {
    approvalWorkflow: {
      createApprovalTasksForObject: typeof createApprovalTasksForObject;
      approveTask: typeof approveTask;
      rejectTask: typeof rejectTask;
      getApprovalTasksForRecord: typeof getApprovalTasksForRecord;
      getTaskApprovalStatusLabel: typeof getTaskApprovalStatusLabel;
      syncAllPendingApprovalTasks: typeof syncAllPendingApprovalTasks;
    };
  }).approvalWorkflow = {
    createApprovalTasksForObject,
    approveTask,
    rejectTask,
    getApprovalTasksForRecord,
    getTaskApprovalStatusLabel,
    syncAllPendingApprovalTasks,
  };
}
