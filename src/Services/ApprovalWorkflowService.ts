import { Cr49f_purchaserequestlinesService } from "../generated/services/Cr49f_purchaserequestlinesService";
import { Cr49f_approvaltasksesService } from "../generated/services/Cr49f_approvaltasksesService";
import { Cr49f_procurementapprovalcyclesService } from "../generated/services/Cr49f_procurementapprovalcyclesService";
import { Cr49f_tasksesService } from "../generated/services/Cr49f_tasksesService";
import { Cr49f_purchaserequestsService } from "../generated/services/Cr49f_purchaserequestsService";
import { Cr49f_requestforqoutationsService } from "../generated/services/Cr49f_requestforqoutationsService";
import { Cr49f_selectedsuppliersesService } from "../generated/services/Cr49f_selectedsuppliersesService";
import { Cr49f_suppliersService } from "../generated/services/Cr49f_suppliersService";
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

export function extractTaskParentIds(task: Cr49f_approvaltaskses | Record<string, unknown>): {
  prId: string;
  rfqId: string;
  poId: string;
} {
  const raw = task as unknown as Record<string, unknown>;
  let prId =
    cleanGuid((task as Cr49f_approvaltaskses)._cr49f_pr_value) ||
    cleanGuid(raw._cr49f_PR_value as string) ||
    cleanGuid(raw.cr49f_pr as string) ||
    cleanGuid(raw.cr49f_PR as string);

  let rfqId =
    cleanGuid((task as Cr49f_approvaltaskses)._cr49f_rfq_value) ||
    cleanGuid(raw._cr49f_RFQ_value as string) ||
    cleanGuid(raw.cr49f_rfq as string) ||
    cleanGuid(raw.cr49f_RFQ as string);

  let poId =
    cleanGuid((task as Cr49f_approvaltaskses)._cr49f_po_value) ||
    cleanGuid(raw._cr49f_PO_value as string) ||
    cleanGuid(raw.cr49f_po as string) ||
    cleanGuid(raw.cr49f_PO as string);

  if (!prId) {
    for (const [key, val] of Object.entries(raw)) {
      if (
        key.toLowerCase().includes("pr") &&
        !key.toLowerCase().includes("approval") &&
        typeof val === "string"
      ) {
        const cleaned = cleanGuid(val);
        if (cleaned && cleaned.length >= 32) {
          prId = cleaned;
          break;
        }
      }
    }
  }

  if (!rfqId) {
    for (const [key, val] of Object.entries(raw)) {
      if (
        key.toLowerCase().includes("rfq") &&
        !key.toLowerCase().includes("approval") &&
        typeof val === "string"
      ) {
        const cleaned = cleanGuid(val);
        if (cleaned && cleaned.length >= 32) {
          rfqId = cleaned;
          break;
        }
      }
    }
  }

  if (!poId) {
    for (const [key, val] of Object.entries(raw)) {
      if (
        key.toLowerCase().includes("po") &&
        !key.toLowerCase().includes("approval") &&
        typeof val === "string"
      ) {
        const cleaned = cleanGuid(val);
        if (cleaned && cleaned.length >= 32) {
          poId = cleaned;
          break;
        }
      }
    }
  }

  return { prId, rfqId, poId };
}

export interface TaskComment {
  id: string;
  text: string;
  author: string;
  timestamp: string;
}

/**
 * Safely parses the cr49f_comments column from Dataverse into a list of TaskComment objects.
 * Handles JSON string array, single/multiline text, and legacy text notes.
 */
export function parseTaskComments(rawComments?: unknown): TaskComment[] {
  if (!rawComments) return [];

  if (Array.isArray(rawComments)) {
    return rawComments.map((item, idx) => {
      if (typeof item === "object" && item !== null) {
        return {
          id: String((item as any).id || `c_${idx}`),
          text: String((item as any).text || ""),
          author: String((item as any).author || "Approver"),
          timestamp: String((item as any).timestamp || new Date().toLocaleDateString()),
        };
      }
      return {
        id: `c_${idx}`,
        text: String(item),
        author: "Approver",
        timestamp: new Date().toLocaleDateString(),
      };
    });
  }

  if (typeof rawComments === "string") {
    const trimmed = rawComments.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item, idx) => ({
            id: String((item as any).id || `c_${idx}`),
            text: String((item as any).text || ""),
            author: String((item as any).author || "Approver"),
            timestamp: String((item as any).timestamp || new Date().toLocaleDateString()),
          }));
        } else if (typeof parsed === "object" && parsed !== null) {
          return [{
            id: String((parsed as any).id || "c_0"),
            text: String((parsed as any).text || ""),
            author: String((parsed as any).author || "Approver"),
            timestamp: String((parsed as any).timestamp || new Date().toLocaleDateString()),
          }];
        }
      } catch {
        // Not valid JSON, fall through to text parsing
      }
    }

    // Check if plain text with multiple lines formatted like "[Date] Author: message"
    const lines = trimmed.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length > 1) {
      const lineComments: TaskComment[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const match = line.match(/^\[(.*?)\]\s*(.*?):\s*(.*)$/);
        if (match) {
          lineComments.push({
            id: `c_line_${i}`,
            timestamp: match[1],
            author: match[2],
            text: match[3],
          });
        } else {
          lineComments.push({
            id: `c_line_${i}`,
            timestamp: "",
            author: "Approver",
            text: line,
          });
        }
      }
      return lineComments;
    }

    return [{
      id: "c_db_0",
      text: trimmed,
      author: "Approver",
      timestamp: "",
    }];
  }

  return [];
}

/**
 * Persists comments on the cr49f_approvaltasks table on the cr49f_comments field in Dataverse,
 * while keeping localStorage updated for instant UI responsiveness.
 */
export async function updateTaskCommentsInDataverse(
  taskId: string,
  commentOrComments: TaskComment | TaskComment[],
  _approverName?: string
): Promise<TaskComment[]> {
  const cleanId = cleanGuid(taskId);
  if (!cleanId) return [];

  // 1. Retrieve current comments from localStorage & Dataverse
  let existingComments: TaskComment[] = [];
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(`task_comments_${cleanId}`);
      if (stored) {
        existingComments = parseTaskComments(stored);
      }
    } catch {}
  }

  // If local storage is empty, attempt to fetch current record from Dataverse to avoid losing existing comments
  if (existingComments.length === 0) {
    try {
      const dbTaskRes = await Cr49f_approvaltasksesService.get(cleanId);
      if (dbTaskRes.data) {
        const raw = dbTaskRes.data as unknown as Record<string, unknown>;
        const dbCommentsVal = dbTaskRes.data.cr49f_comments ?? raw.cr49f_comments ?? raw.cr49f_Comments;
        if (dbCommentsVal) {
          existingComments = parseTaskComments(dbCommentsVal);
        }
      }
    } catch (fetchErr) {
      console.warn(`[ApprovalWorkflow] Could not pre-fetch comments for task ${cleanId}:`, fetchErr);
    }
  }

  // 2. Append new comment(s)
  const toAdd: TaskComment[] = Array.isArray(commentOrComments) ? commentOrComments : [commentOrComments];
  const merged: TaskComment[] = [...existingComments];

  for (const c of toAdd) {
    const alreadyExists = merged.some(
      (m) => (m.id && m.id === c.id) || (m.text === c.text && m.timestamp === c.timestamp && m.author === c.author)
    );
    if (!alreadyExists) {
      merged.push(c);
    }
  }

  const serialized = JSON.stringify(merged);

  // 3. Update localStorage
  if (typeof window !== "undefined") {
    localStorage.setItem(`task_comments_${cleanId}`, serialized);
  }

  // 4. Update Dataverse cr49f_approvaltasks on cr49f_comments field!
  try {
    await Cr49f_approvaltasksesService.update(cleanId, {
      cr49f_comments: serialized,
    } as any);
    console.log(`[ApprovalWorkflow] Successfully updated cr49f_comments on task ${cleanId}`);
  } catch (updateErr) {
    console.warn(`[ApprovalWorkflow] Direct update of cr49f_comments failed, trying alternate case:`, updateErr);
    try {
      await Cr49f_approvaltasksesService.update(cleanId, {
        cr49f_Comments: serialized,
      } as any);
    } catch (altErr) {
      console.warn(`[ApprovalWorkflow] Failed to update cr49f_comments on ${cleanId}:`, altErr);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("approvalTasksUpdated"));
  }

  return merged;
}

export async function addTaskComment(
  taskId: string,
  text: string,
  authorName?: string
): Promise<TaskComment[]> {
  const cleanId = cleanGuid(taskId);
  if (!cleanId || !text.trim()) return [];

  let resolvedAuthor = authorName?.trim();
  if (!resolvedAuthor && typeof window !== "undefined") {
    resolvedAuthor =
      localStorage.getItem("procurement_user_name") ||
      localStorage.getItem("userName") ||
      "Subrata Dey";
  }
  if (!resolvedAuthor) resolvedAuthor = "Subrata Dey";

  const newComment: TaskComment = {
    id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    text: text.trim(),
    author: resolvedAuthor,
    timestamp: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
  };

  return await updateTaskCommentsInDataverse(cleanId, newComment, resolvedAuthor);
}

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
// Exact Dataverse Choices for cr49f_approvalstatus:
// 1 = Pending
// 2 = Approved
// 3 = Rejected
export const APPROVED_CHOICE_VALUE = 2;
export const REJECTED_CHOICE_VALUE = 3;
export const PENDING_CHOICE_VALUE = 1;

export const APPROVED_CHOICE_CANDIDATES = [2, 154890001, 100000001];
export const REJECTED_CHOICE_CANDIDATES = [3, 154890002, 100000002];
export const PENDING_CHOICE_CANDIDATES = [1, 154890000, 100000000];
export const CHANGES_NEEDED_CHOICE_VALUE = 4;
export const CHANGES_NEEDED_CHOICE_CANDIDATES = [4, 154890003, 100000003, 2, 0];

const STATUS_CANDIDATES: StatusStrategy[] = [
  {
    fieldName: "cr49f_approvalstatus",
    pendingVal: 1,
    approvedVal: 2,
    rejectedVal: 3,
    label: "cr49f_approvalstatus (Dataverse Choice: 1=Pending, 2=Approved, 3=Rejected)",
  },
  {
    fieldName: "cr49f_approvalstatus",
    pendingVal: 154890000,
    approvedVal: 154890001,
    rejectedVal: 154890002,
    label: "cr49f_approvalstatus (Publisher prefix 154890000=Pending, 154890001=Approved, 154890002=Rejected)",
  },
  {
    fieldName: "cr49f_approvalstatus",
    pendingVal: "Pending",
    approvedVal: "Approved",
    rejectedVal: "Rejected",
    label: "cr49f_approvalstatus (Text string)",
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
    const nowIso = new Date().toISOString();
    const basePayload: Record<string, unknown> = {
      cr49f_task: taskNameTruncated,
      cr49f_object: params.objectType as keyof typeof Cr49f_approvaltasksescr49f_object,
      cr49f_sequence: t.cr49f_sequencenumber || i + 1,
      cr49f_department: (t.cr49f_department || 1) as keyof typeof Cr49f_approvaltasksescr49f_department,
      cr49f_role: (t.cr49f_role || 2) as keyof typeof Cr49f_approvaltasksescr49f_role,
      cr49f_slanumber: t.cr49f_slanumber || 24,
      cr49f_slaunit: safeSlaUnit,
      cr49f_approvalstatus: 1, // 1 = Pending
      cr49f_assignedon: nowIso,
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

/**
 * Adaptively updates cr49f_approvalstatus across multiple known Dataverse picklist value conventions:
 * 1. 154890001 (Environment publisher prefix 'cr49f')
 * 2. 1 (0-indexed choice: 0=Pending, 1=Approved, 2=Rejected)
 * 3. 2 (1-indexed choice: 1=Pending, 2=Approved, 3=Rejected)
 * 4. 100000001 (Default solution prefix choice)
 * 5. String 'Approved'/'Rejected'/'Pending'
 */
export async function setTaskApprovalStatusInDataverse(
  taskId: string,
  targetStatus: "Approved" | "Rejected" | "Pending" | "Changes Needed",
  extraFields?: Record<string, unknown>
): Promise<Cr49f_approvaltaskses | null> {
  const cleanId = cleanGuid(taskId);
  if (!cleanId) return null;

  const candidateValues =
    targetStatus === "Approved"
      ? APPROVED_CHOICE_CANDIDATES
      : targetStatus === "Rejected"
        ? REJECTED_CHOICE_CANDIDATES
        : targetStatus === "Changes Needed"
          ? CHANGES_NEEDED_CHOICE_CANDIDATES
          : PENDING_CHOICE_CANDIDATES;

  // 1. Try updating with full extra fields first (choiceVal as number: 2=Approved, 3=Rejected, 1=Pending)
  for (const choiceVal of candidateValues) {
    try {
      const payload: Record<string, unknown> = {
        cr49f_approvalstatus: choiceVal,
        ...(extraFields || {}),
      };
      const res = await Cr49f_approvaltasksesService.update(
        cleanId,
        payload as Parameters<typeof Cr49f_approvaltasksesService.update>[1]
      );
      if (res && !res.error && (res.data !== undefined || res.success)) {
        console.log(`[ApprovalWorkflow] Successfully updated task ${cleanId} to ${targetStatus} with choice value ${choiceVal}`);
        if (typeof window !== "undefined") {
          localStorage.setItem("cr49f_working_approved_choice", String(choiceVal));
        }
        return (res.data || { cr49f_approvaltasksid: cleanId, cr49f_approvalstatus: choiceVal, ...extraFields }) as Cr49f_approvaltaskses;
      } else if (res?.error) {
        console.warn(`[ApprovalWorkflow] Choice ${choiceVal} returned error:`, res.error);
      }
    } catch (err) {
      console.warn(`[ApprovalWorkflow] Exception updating choice ${choiceVal}:`, err);
    }
  }

  // 2. Try updating cr49f_approvalstatus alone
  for (const choiceVal of candidateValues) {
    try {
      const res = await Cr49f_approvaltasksesService.update(
        cleanId,
        { cr49f_approvalstatus: choiceVal } as Parameters<typeof Cr49f_approvaltasksesService.update>[1]
      );
      if (res && !res.error && (res.data !== undefined || res.success)) {
        console.log(`[ApprovalWorkflow] Successfully updated cr49f_approvalstatus alone to ${choiceVal}`);
        return (res.data || { cr49f_approvaltasksid: cleanId, cr49f_approvalstatus: choiceVal, ...(extraFields || {}) }) as Cr49f_approvaltaskses;
      }
    } catch { }
  }

  // 3. Try with PascalCase cr49f_ApprovalStatus
  for (const choiceVal of candidateValues) {
    try {
      const res = await Cr49f_approvaltasksesService.update(
        cleanId,
        { cr49f_ApprovalStatus: choiceVal, ...(extraFields || {}) } as any
      );
      if (res && !res.error && (res.data !== undefined || res.success)) {
        console.log(`[ApprovalWorkflow] Successfully updated cr49f_ApprovalStatus to ${choiceVal}`);
        return (res.data || { cr49f_approvaltasksid: cleanId, cr49f_approvalstatus: choiceVal, ...(extraFields || {}) }) as Cr49f_approvaltaskses;
      }
    } catch { }
  }

  // 4. Try string target ("Approved", "Rejected", "Pending")
  try {
    const res = await Cr49f_approvaltasksesService.update(
      cleanId,
      { cr49f_approvalstatus: targetStatus, ...(extraFields || {}) } as any
    );
    if (res && !res.error && (res.data !== undefined || res.success)) {
      return (res.data || { cr49f_approvaltasksid: cleanId, cr49f_approvalstatus: targetStatus, ...(extraFields || {}) }) as Cr49f_approvaltaskses;
    }
  } catch { }

  // 5. Try numeric string ("2", "3", "1")
  for (const choiceVal of candidateValues) {
    try {
      const res = await Cr49f_approvaltasksesService.update(
        cleanId,
        { cr49f_approvalstatus: String(choiceVal), ...(extraFields || {}) } as any
      );
      if (res && !res.error && (res.data !== undefined || res.success)) {
        return (res.data || { cr49f_approvaltasksid: cleanId, cr49f_approvalstatus: choiceVal, ...(extraFields || {}) }) as Cr49f_approvaltaskses;
      }
    } catch { }
  }

  return null;
}

export async function approveTask(
  approvalTaskId: string,
  approverName?: string
): Promise<{
  updatedTask: Cr49f_approvaltaskses;
  nextActivatedTask: Cr49f_approvaltaskses | null;
  parentCompleted: boolean;
}> {
  const cleanTaskId = cleanGuid(approvalTaskId);
  if (!cleanTaskId) throw new Error("Invalid approval task ID");

  console.log(`[ApprovalWorkflow] Approving task: ${cleanTaskId}`);

  // Step 1: Pre-fetch all tasks to reliably locate current task, its parent PR/RFQ, and sequence
  let allTasks: Cr49f_approvaltaskses[] = [];
  try {
    const allRes = await Cr49f_approvaltasksesService.getAll();
    allTasks = allRes.data ?? [];
  } catch (fetchErr) {
    console.warn("[ApprovalWorkflow] Failed to fetch all tasks:", fetchErr);
  }

  const currentTask = allTasks.find((t) => {
    const raw = t as unknown as Record<string, unknown>;
    const tId = cleanGuid(
      t.cr49f_approvaltasksid ||
      (raw.cr49f_ApprovalTasksId as string) ||
      (raw.id as string)
    );
    return tId === cleanTaskId;
  });

  const rawCurrent = (currentTask ?? {}) as unknown as Record<string, unknown>;
  const currentSeq = currentTask?.cr49f_sequence ?? 1;

  const parentPR =
    cleanGuid(currentTask?._cr49f_pr_value) ||
    cleanGuid(rawCurrent._cr49f_PR_value as string) ||
    cleanGuid(rawCurrent.cr49f_pr as string) ||
    cleanGuid(rawCurrent.cr49f_PR as string);

  const parentRFQ =
    cleanGuid(currentTask?._cr49f_rfq_value) ||
    cleanGuid(rawCurrent._cr49f_RFQ_value as string) ||
    cleanGuid(rawCurrent.cr49f_rfq as string) ||
    cleanGuid(rawCurrent.cr49f_RFQ as string);

  const parentPO =
    cleanGuid(currentTask?._cr49f_po_value) ||
    cleanGuid(rawCurrent._cr49f_PO_value as string) ||
    cleanGuid(rawCurrent.cr49f_po as string) ||
    cleanGuid(rawCurrent.cr49f_PO as string);

  const nowIso = new Date().toISOString();

  // Resolve approver display name
  let resolvedApprover = approverName?.trim();
  if (!resolvedApprover && typeof window !== "undefined") {
    try {
      resolvedApprover =
        localStorage.getItem("procurement_user_name") ||
        localStorage.getItem("userName") ||
        "Subrata Dey";
    } catch {
      resolvedApprover = "Subrata Dey";
    }
  }
  if (!resolvedApprover) resolvedApprover = "Subrata Dey";

  const taskAssignedOn =
    currentTask?.cr49f_assignedon ||
    (rawCurrent.cr49f_assignedon as string) ||
    (rawCurrent.createdon as string) ||
    nowIso;

  // Step 2: Attempt Dataverse updates across all candidate choice codes
  const fullApprovalFields: Record<string, unknown> = {
    cr49f_approvalstatus: APPROVED_CHOICE_VALUE,
    cr49f_approvedby: resolvedApprover,
    cr49f_approvedon: nowIso,
    cr49f_assignedon: taskAssignedOn,
  };

  let updateResultRecord = await setTaskApprovalStatusInDataverse(
    cleanTaskId,
    "Approved",
    fullApprovalFields
  );

  // Always ensure cr49f_approvedby, cr49f_approvedon, and cr49f_assignedon are saved
  try {
    await Cr49f_approvaltasksesService.update(cleanTaskId, fullApprovalFields as any);
  } catch (fieldErr) {
    console.warn("[ApprovalWorkflow] Field update note:", fieldErr);
  }

  // Always store approval in local storage overlay for instant, deterministic UI reactivity
  if (typeof window !== "undefined") {
    localStorage.setItem(`task_approved_status_${cleanTaskId}`, "Approved");
    localStorage.setItem(`task_active_${cleanTaskId}`, "false");
    localStorage.setItem(`task_approved_by_${cleanTaskId}`, resolvedApprover);
    localStorage.setItem(`task_approved_on_${cleanTaskId}`, nowIso);
    localStorage.setItem(`task_assigned_on_${cleanTaskId}`, taskAssignedOn);

    const approveComment: TaskComment = {
      id: `c_${Date.now()}`,
      text: "Approved task",
      author: resolvedApprover,
      timestamp: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    };
    void updateTaskCommentsInDataverse(cleanTaskId, approveComment, resolvedApprover);
  }

  const resolvedTask: Cr49f_approvaltaskses = updateResultRecord ||
    currentTask || ({
      cr49f_approvaltasksid: cleanTaskId,
      cr49f_task: "Approved Task",
      cr49f_sequence: currentSeq,
      cr49f_approvalstatus: 2 as unknown as Cr49f_approvaltaskses["cr49f_approvalstatus"],
      cr49f_approvedby: resolvedApprover,
      cr49f_approvedon: nowIso,
      cr49f_assignedon: taskAssignedOn,
      statecode: 0 as const,
      statuscode: 1 as const,
      ownerid: "system",
      owneridtype: "system",
    } as unknown as Cr49f_approvaltaskses);

  resolvedTask.cr49f_approvalstatus = 2 as unknown as Cr49f_approvaltaskses["cr49f_approvalstatus"];
  resolvedTask.cr49f_approvedby = resolvedApprover;
  resolvedTask.cr49f_approvedon = nowIso;
  resolvedTask.cr49f_assignedon = taskAssignedOn;

  // Step 3: Find next sequential task among siblings
  const siblingTasks = allTasks.filter((t) => {
    const { prId: tPR, rfqId: tRFQ, poId: tPO } = extractTaskParentIds(t);
    if (parentPR && tPR === parentPR) return true;
    if (parentRFQ && tRFQ === parentRFQ) return true;
    if (parentPO && tPO === parentPO) return true;
    return false;
  });

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
      const nextAssignedOn = new Date().toISOString();
      try {
        const activateRes = await Cr49f_approvaltasksesService.update(nextId, {
          statecode: 0, // Active
          statuscode: 1, // Active
          cr49f_assignedon: nextAssignedOn,
        } as any);
        if (activateRes.data) {
          nextActivatedTask = activateRes.data;
        }
      } catch (actErr) {
        try {
          const activateRes = await Cr49f_approvaltasksesService.update(nextId, {
            statecode: 0,
            statuscode: 1,
          });
          if (activateRes.data) nextActivatedTask = activateRes.data;
        } catch { }
      }

      // Explicitly set next task to Pending using candidate choice values
      void setTaskApprovalStatusInDataverse(nextId, "Pending");

      if (typeof window !== "undefined") {
        localStorage.setItem(`task_active_${nextId}`, "true");
        localStorage.setItem(`task_approved_status_${nextId}`, "Pending");
        localStorage.setItem(`task_assigned_on_${nextId}`, nextAssignedOn);
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
      if (typeof window !== "undefined") {
        localStorage.setItem(`pr_status_${parentPR}`, "Approved");
      }
    } else if (parentRFQ) {
      try {
        await Cr49f_requestforqoutationsService.update(parentRFQ, { cr49f_status: 1 }); // 1 = Approved
      } catch (rfqErr) {
        console.warn("[ApprovalWorkflow] Could not update parent RFQ to Approved:", rfqErr);
      }
      if (typeof window !== "undefined") {
        localStorage.setItem(`rfq_status_${parentRFQ}`, "Approved");
      }
      // Initialize supplier responses and response lines now that all RFQ tasks are approved
      try {
        const { initializeSupplierResponsesForApprovedRfq } = await import("./RfqSupplierResponseService");
        await initializeSupplierResponsesForApprovedRfq(parentRFQ);
      } catch (respInitErr) {
        console.warn("[ApprovalWorkflow] Could not initialize supplier responses on RFQ approval:", respInitErr);
      }
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("approvalTasksUpdated"));
  }

  return {
    updatedTask: resolvedTask,
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
export async function rejectTask(
  approvalTaskId: string,
  rejectorName?: string
): Promise<{
  rejectedTask: Cr49f_approvaltaskses;
  parentRejected: boolean;
}> {
  const cleanTaskId = cleanGuid(approvalTaskId);
  if (!cleanTaskId) throw new Error("Invalid approval task ID");

  console.log(`[ApprovalWorkflow] Rejecting task: ${cleanTaskId}`);

  let allTasks: Cr49f_approvaltaskses[] = [];
  try {
    const allRes = await Cr49f_approvaltasksesService.getAll();
    allTasks = allRes.data ?? [];
  } catch (fetchErr) {
    console.warn("[ApprovalWorkflow] Failed to fetch all tasks:", fetchErr);
  }

  const currentTask = allTasks.find((t) => {
    const raw = t as unknown as Record<string, unknown>;
    const tId = cleanGuid(
      t.cr49f_approvaltasksid ||
      (raw.cr49f_ApprovalTasksId as string) ||
      (raw.id as string)
    );
    return tId === cleanTaskId;
  });

  const rawCurrent = (currentTask ?? {}) as unknown as Record<string, unknown>;
  const { prId: parentPR, rfqId: parentRFQ } = extractTaskParentIds(currentTask || rawCurrent);

  const nowIso = new Date().toISOString();
  let resolvedRejector = rejectorName?.trim();
  if (!resolvedRejector && typeof window !== "undefined") {
    try {
      resolvedRejector =
        localStorage.getItem("procurement_user_name") ||
        localStorage.getItem("userName") ||
        "Subrata Dey";
    } catch {
      resolvedRejector = "Subrata Dey";
    }
  }
  if (!resolvedRejector) resolvedRejector = "Subrata Dey";

  let updateResultRecord = await setTaskApprovalStatusInDataverse(
    cleanTaskId,
    "Rejected",
    {
      cr49f_approvedby: resolvedRejector,
      cr49f_approvedon: nowIso,
    }
  );

  if (typeof window !== "undefined") {
    localStorage.setItem(`task_approved_status_${cleanTaskId}`, "Rejected");
    localStorage.setItem(`task_active_${cleanTaskId}`, "false");
    localStorage.setItem(`task_approved_by_${cleanTaskId}`, resolvedRejector);
    localStorage.setItem(`task_approved_on_${cleanTaskId}`, nowIso);

    const rejectComment: TaskComment = {
      id: `c_${Date.now()}`,
      text: "Rejected task",
      author: resolvedRejector,
      timestamp: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    };
    void updateTaskCommentsInDataverse(cleanTaskId, rejectComment, resolvedRejector);
  }

  if (parentPR) {
    try {
      await Cr49f_purchaserequestsService.update(parentPR, { cr49f_status: 3 }); // 3 = Rejected
    } catch (prErr) {
      console.warn("[ApprovalWorkflow] Could not update parent PR to Rejected:", prErr);
    }
    if (typeof window !== "undefined") {
      localStorage.setItem(`pr_status_${parentPR}`, "Rejected");
    }
  } else if (parentRFQ) {
    try {
      await Cr49f_requestforqoutationsService.update(parentRFQ, { cr49f_status: 3 }); // 3 = Rejected
    } catch (rfqErr) {
      console.warn("[ApprovalWorkflow] Could not update parent RFQ to Rejected:", rfqErr);
    }
    if (typeof window !== "undefined") {
      localStorage.setItem(`rfq_status_${parentRFQ}`, "Rejected");
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("approvalTasksUpdated"));
  }

  return {
    rejectedTask: updateResultRecord || currentTask || ({
      cr49f_approvaltasksid: cleanTaskId,
      cr49f_approvalstatus: 3,
      cr49f_approvedby: resolvedRejector,
      cr49f_approvedon: nowIso,
    } as unknown as Cr49f_approvaltaskses),
    parentRejected: true,
  };
}

/**
 * Retrieves all approval tasks for a given PR, RFQ, or PO sorted by sequence.
 * Uses comprehensive lookup resolution to match uppercase and lowercase Dataverse property names.
 */
/**
 * Executes the "Changes Needed" workflow on ANY approval task (PR, RFQ, PO):
 * 1. Sets approval status to Pending (1) and record status to Inactive (statecode: 1, statuscode: 2)
 *    on all existing approval tasks for this PR or RFQ.
 * 2. Updates the parent record status (PR or RFQ) to Changes Needed (cr49f_status: 2) in Dataverse.
 * 3. Creates a new active approval task record in cr49f_approvaltasks with:
 *    - Approval Status = Changes Needed (cr49f_approvalstatus: 4)
 *    - Record Status = Active (statecode: 0, statuscode: 1)
 *    - Sequence = 0
 *    - Object = 1 (PR), 2 (RFQ), or 3 (PO)
 *    - Parent binding ("cr49f_PR@odata.bind" or "cr49f_RFQ@odata.bind")
 * 4. Records the approver's remarks in the audit trail comments.
 */
export async function requestChangesOnTask(
  approvalTaskId: string,
  approverRemarks: string,
  approverName?: string
): Promise<{
  parentPRId?: string;
  parentRFQId?: string;
  parentPOId?: string;
  newTaskId?: string;
  success: boolean;
}> {
  const cleanTaskId = cleanGuid(approvalTaskId);
  if (!cleanTaskId) throw new Error("Invalid approval task ID");

  console.log(`[ApprovalWorkflow] Requesting Changes Needed on task: ${cleanTaskId}`);

  // Fetch all tasks to locate current task and its parent record
  let allTasks: Cr49f_approvaltaskses[] = [];
  try {
    const allRes = await Cr49f_approvaltasksesService.getAll();
    allTasks = allRes.data ?? [];
  } catch (fetchErr) {
    console.warn("[ApprovalWorkflow] Failed to fetch tasks:", fetchErr);
  }

  const currentTask = allTasks.find((t) => {
    const raw = t as unknown as Record<string, unknown>;
    const tId = cleanGuid(
      t.cr49f_approvaltasksid ||
      (raw.cr49f_ApprovalTasksId as string) ||
      (raw.id as string)
    );
    return tId === cleanTaskId;
  });

  const rawCurrent = (currentTask || {}) as unknown as Record<string, unknown>;
  const { prId: parentPRId, rfqId: parentRFQId, poId: parentPOId } = extractTaskParentIds(currentTask || rawCurrent);

  const taskTitleLower = String(currentTask?.cr49f_task || "").toLowerCase();
  const isObjectRfq =
    currentTask?.cr49f_object === 2 ||
    Boolean(parentRFQId) ||
    taskTitleLower.includes("rfq") ||
    taskTitleLower.includes("quotation");

  const isObjectPr = !isObjectRfq && (currentTask?.cr49f_object === 1 || Boolean(parentPRId));
  const isObjectPo = !isObjectRfq && !isObjectPr && (currentTask?.cr49f_object === 3 || Boolean(parentPOId));

  // 1. Identify all sibling tasks for this parent object
  const siblingTasks = allTasks.filter((t) => {
    const raw = t as unknown as Record<string, unknown>;
    const { prId: tPR, rfqId: tRFQ, poId: tPO } = extractTaskParentIds(t);

    if (isObjectRfq && parentRFQId && tRFQ === parentRFQId) return true;
    if (isObjectPr && parentPRId && tPR === parentPRId) return true;
    if (isObjectPo && parentPOId && tPO === parentPOId) return true;

    const tId = cleanGuid(t.cr49f_approvaltasksid || (raw.cr49f_ApprovalTasksId as string) || (raw.id as string));
    if (tId === cleanTaskId) return true;

    return false;
  });

  // 2. Set approval status = Pending (1) and record status = Inactive on ALL existing sibling tasks
  // (All tasks get completely reset: any previously approved tasks also become pending and inactive)
  console.log(`[ApprovalWorkflow] Resetting ${siblingTasks.length} existing tasks to Inactive Pending`);
  for (const sib of siblingTasks) {
    const sibId = cleanGuid(
      sib.cr49f_approvaltasksid ||
      (sib as unknown as Record<string, string>).cr49f_ApprovalTasksId
    );
    if (!sibId) continue;

    const resetPayload: Record<string, unknown> = {
      statecode: 1, // Inactive
      statuscode: 2, // Inactive
      cr49f_approvalstatus: 1 as any, // Pending
      cr49f_approvedby: null,
      cr49f_approvedon: null,
    };

    try {
      await Cr49f_approvaltasksesService.update(sibId, resetPayload as any);
    } catch {
      try {
        await Cr49f_approvaltasksesService.update(sibId, {
          statecode: 1,
          statuscode: 2,
          cr49f_approvalstatus: 1,
          cr49f_approvedby: "",
        } as any);
      } catch (sibErr) {
        console.warn(`[ApprovalWorkflow] Could not update sibling task ${sibId} to Inactive Pending:`, sibErr);
      }
    }

    void setTaskApprovalStatusInDataverse(sibId, "Pending", {
      cr49f_approvedby: null,
      cr49f_approvedon: null,
    });

    if (typeof window !== "undefined") {
      localStorage.setItem(`task_active_${sibId}`, "false");
      localStorage.setItem(`task_approved_status_${sibId}`, "Pending");
      localStorage.removeItem(`task_approved_by_${sibId}`);
      localStorage.removeItem(`task_approved_on_${sibId}`);
    }

    // Reset in-memory task object completely
    sib.cr49f_approvalstatus = 1 as any;
    sib.statecode = 1 as any;
    sib.statuscode = 2 as any;
    sib.cr49f_approvedby = "";
    sib.cr49f_approvedon = "";
    delete (sib as any).cr49f_approvedby;
    delete (sib as any).cr49f_approvedon;
  }

  // 3. Update parent record status to Changes Needed (cr49f_status: 2) in Dataverse
  if (isObjectRfq && parentRFQId) {
    try {
      await Cr49f_requestforqoutationsService.update(parentRFQId, {
        cr49f_status: 2, // 2 = ChangesNeeded in Dataverse schema
      });
      console.log(`[ApprovalWorkflow] Successfully updated RFQ ${parentRFQId} status to Changes Needed (2)`);
    } catch (rfqErr) {
      console.warn("[ApprovalWorkflow] Could not update parent RFQ status to Changes Needed:", rfqErr);
    }
    if (typeof window !== "undefined") {
      localStorage.setItem(`rfq_status_${parentRFQId}`, "Changes Needed");
      localStorage.setItem(`rfq_changes_reason_${parentRFQId}`, approverRemarks || "Revisions requested by approver.");
    }
  } else if (parentPRId) {
    try {
      await Cr49f_purchaserequestsService.update(parentPRId, {
        cr49f_status: 2, // 2 = ChangesNeeded in Dataverse schema
      });
      console.log(`[ApprovalWorkflow] Successfully updated PR ${parentPRId} status to Changes Needed (2)`);
    } catch (prErr) {
      console.warn("[ApprovalWorkflow] Could not update parent PR status to Changes Needed:", prErr);
    }
    if (typeof window !== "undefined") {
      localStorage.setItem(`pr_status_${parentPRId}`, "Changes Needed");
      localStorage.setItem(`pr_changes_reason_${parentPRId}`, approverRemarks || "Revisions requested by approver.");
    }
  }

  if (parentPOId && typeof window !== "undefined") {
    localStorage.setItem(`po_status_${parentPOId}`, "Changes Needed");
    localStorage.setItem(`po_changes_reason_${parentPOId}`, approverRemarks || "Revisions requested by approver.");
  }

  // 4. Create new active approval task record with Approval Status = Changes Needed (4)
  const nowIso = new Date().toISOString();
  const truncatedTaskName = `Changes Needed: ${(approverRemarks || "Review and update required details").trim()}`.slice(0, 95);

  const remarkComment: TaskComment = {
    id: `c_${Date.now()}`,
    text: `Changes Needed: ${(approverRemarks || "").trim()}`,
    author: approverName?.trim() || "Approver",
    timestamp: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
  };

  const newChangesPayload: Record<string, unknown> = {
    cr49f_task: truncatedTaskName,
    cr49f_object: (isObjectRfq ? 2 : isObjectPo ? 3 : 1) as keyof typeof Cr49f_approvaltasksescr49f_object,
    cr49f_sequence: 0,
    cr49f_role: 1 as keyof typeof Cr49f_approvaltasksescr49f_role, // Requester
    cr49f_department: (currentTask?.cr49f_department || 1) as keyof typeof Cr49f_approvaltasksescr49f_department,
    cr49f_slanumber: 48,
    cr49f_slaunit: 1 as keyof typeof Cr49f_approvaltasksescr49f_slaunit,
    cr49f_approvalstatus: 4, // 4 = Changes Needed in Dataverse
    cr49f_assignedon: nowIso,
    cr49f_comments: JSON.stringify([remarkComment]),
  };

  if (isObjectRfq && parentRFQId) {
    newChangesPayload["cr49f_RFQ@odata.bind"] = `/cr49f_requestforqoutations(${parentRFQId})`;
  } else if (parentPRId) {
    newChangesPayload["cr49f_PR@odata.bind"] = `/cr49f_purchaserequests(${parentPRId})`;
  } else if (parentPOId) {
    newChangesPayload["cr49f_PO@odata.bind"] = `/cr49f_purchaserequests(${parentPOId})`;
  }

  let createdChangesTask: Cr49f_approvaltaskses | null = null;
  try {
    console.log("[ApprovalWorkflow] Creating Changes Needed task in Dataverse:", newChangesPayload);
    const createRes = await Cr49f_approvaltasksesService.create(
      newChangesPayload as Parameters<typeof Cr49f_approvaltasksesService.create>[0]
    );
    if (createRes.data) {
      createdChangesTask = createRes.data;
      console.log("[ApprovalWorkflow] Successfully created Changes Needed task:", createRes.data);
    } else {
      console.warn("[ApprovalWorkflow] Create returned error:", createRes.error);
    }
  } catch (createErr) {
    console.warn("[ApprovalWorkflow] Error creating Changes Needed task:", createErr);
  }

  // Fallback candidate values if choice 4 required publisher prefix or string
  if (!createdChangesTask) {
    for (const altVal of [154890003, 100000003, "Changes Needed"]) {
      try {
        const altPayload = { ...newChangesPayload, cr49f_approvalstatus: altVal };
        const altRes = await Cr49f_approvaltasksesService.create(altPayload as any);
        if (altRes.data) {
          createdChangesTask = altRes.data;
          break;
        }
      } catch { }
    }
  }

  const newTaskId = cleanGuid(
    createdChangesTask?.cr49f_approvaltasksid ||
    (createdChangesTask as unknown as Record<string, string>)?.cr49f_ApprovalTasksId ||
    `changes_${Date.now()}`
  );

  // 5. Store in local state overlay & record in comments audit trail
  if (typeof window !== "undefined") {
    localStorage.setItem(`task_approved_status_${newTaskId}`, "Changes Needed");
    localStorage.setItem(`task_active_${newTaskId}`, "true");
    localStorage.setItem(`task_assigned_on_${newTaskId}`, nowIso);
    localStorage.setItem(`task_changes_reason_${newTaskId}`, approverRemarks || "");

    const remarkComment = {
      id: `c_${Date.now()}`,
      text: `Changes Needed: ${approverRemarks.trim()}`,
      author: approverName?.trim() || "Approver",
      timestamp: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    };

    for (const tid of [cleanTaskId, newTaskId]) {
      void updateTaskCommentsInDataverse(tid, remarkComment, approverName);
    }

    window.dispatchEvent(new CustomEvent("approvalTasksUpdated"));
  }

  return {
    parentPRId,
    parentRFQId,
    parentPOId,
    newTaskId,
    success: true,
  };
}

/**
 * Saves updated PR or RFQ information, marks the Changes Needed task as completed/inactive,
 * and restarts the approval workflow from the first approval level (Step 1 active, all subsequent inactive pending).
 */
export async function submitChangesNeededUpdate(params: {
  changesNeededTaskId: string;
  prId?: string;
  rfqId?: string;
  updatedPR?: {
    cr49f_prtitle?: string;
    cr49f_businessjustification?: string;
    cr49f_deliverylocation?: string;
    cr49f_requireddeliverydate?: string;
    cr49f_priority?: number;
    cr49f_totalamount?: number;
  };
  updatedLines?: Array<{
    lineId?: string;
    itemName?: string;
    description?: string;
    category?: string;
    quantity?: number;
    unitPrice?: number;
  }>;
  deletedLineIds?: string[];
  updatedRFQ?: {
    cr49f_rfqtitle?: string;
    cr49f_submissiondeadline?: string;
    cr49f_deliverylocation?: string;
    cr49f_description?: string;
    purchaseRequestId?: string;
  };
  selectedSupplierIds?: string[];
  requesterRemarks?: string;
  requesterName?: string;
}): Promise<{
  success: boolean;
  firstActivatedTask: Cr49f_approvaltaskses | null;
}> {
  const cleanTaskId = cleanGuid(params.changesNeededTaskId);
  const cleanPRId = cleanGuid(params.prId);
  const cleanRFQId = cleanGuid(params.rfqId);

  console.log(`[ApprovalWorkflow] Submitting revisions for task: ${cleanTaskId}, PR: ${cleanPRId}, RFQ: ${cleanRFQId}`);

  const nowIso = new Date().toISOString();
  const requester = params.requesterName?.trim() || "Requester";

  // 1. If PR updates provided, save line items and update PR record in Dataverse
  if (cleanPRId && params.updatedPR) {
    let calculatedTotal = params.updatedPR.cr49f_totalamount;

    // Delete any removed line items
    if (params.deletedLineIds && params.deletedLineIds.length > 0) {
      for (const delId of params.deletedLineIds) {
        const cleanDelId = cleanGuid(delId);
        if (cleanDelId && !cleanDelId.startsWith("new_")) {
          try {
            await Cr49f_purchaserequestlinesService.delete(cleanDelId);
            console.log(`[ApprovalWorkflow] Deleted removed PR line: ${cleanDelId}`);
          } catch (delErr) {
            console.warn(`[ApprovalWorkflow] Could not delete PR line ${cleanDelId}:`, delErr);
          }
        }
      }
    }

    if (params.updatedLines && params.updatedLines.length > 0) {
      let runningTotal = 0;
      for (const l of params.updatedLines) {
        const cleanLineId = cleanGuid(l.lineId);
        const qty = Number(l.quantity) || 1;
        const price = Number(l.unitPrice) || 0;
        runningTotal += qty * price;

        if (cleanLineId && !cleanLineId.startsWith("new_")) {
          // Update existing line
          const linePatch: Record<string, unknown> = {};
          if (l.quantity !== undefined) linePatch.cr49f_quantity = qty;
          if (l.unitPrice !== undefined) linePatch.cr49f_unitprice = price;
          if (l.description !== undefined) linePatch.cr49f_itemdescription = l.description;
          if (l.itemName !== undefined) linePatch.cr49f_itemname = l.itemName;
          if (l.category !== undefined) linePatch.cr49f_category = l.category;

          try {
            await Cr49f_purchaserequestlinesService.update(cleanLineId, linePatch as any);
          } catch (lineErr) {
            console.warn(`[ApprovalWorkflow] Could not update PR line ${cleanLineId}:`, lineErr);
          }
        } else {
          // Create new line
          try {
            await Cr49f_purchaserequestlinesService.create({
              cr49f_itemname: l.itemName || l.description || "Product Item",
              cr49f_itemdescription: l.description || "",
              cr49f_category: l.category || "",
              cr49f_quantity: qty,
              cr49f_unitprice: price,
              "cr49f_PurchaseRequest@odata.bind": `/cr49f_purchaserequests(${cleanPRId})`,
              statecode: 0,
              statuscode: 1,
            } as any);
            console.log(`[ApprovalWorkflow] Created new PR line for PR ${cleanPRId}`);
          } catch (createLineErr) {
            console.warn(`[ApprovalWorkflow] Could not create new PR line:`, createLineErr);
          }
        }
      }
      if (runningTotal > 0 && calculatedTotal === undefined) {
        calculatedTotal = runningTotal;
      }
    }

    const prPayload: Record<string, unknown> = {
      ...params.updatedPR,
      cr49f_status: 0, // 0 = Pending in Dataverse schema
    };
    if (calculatedTotal !== undefined) {
      prPayload.cr49f_totalamount = calculatedTotal;
    }

    try {
      await Cr49f_purchaserequestsService.update(cleanPRId, prPayload as any);
      console.log(`[ApprovalWorkflow] Updated PR ${cleanPRId} to Pending (0)`);
    } catch (prUpdateErr) {
      console.warn(`[ApprovalWorkflow] Failed to update parent PR ${cleanPRId}:`, prUpdateErr);
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(`pr_status_${cleanPRId}`, "Pending");
      localStorage.removeItem(`pr_changes_reason_${cleanPRId}`);
    }
  }

  // 2. If RFQ updates provided, save RFQ record in Dataverse and sync suppliers
  if (cleanRFQId && params.updatedRFQ) {
    const rfqPayload: Record<string, unknown> = {
      ...params.updatedRFQ,
      cr49f_status: 0, // 0 = Pending in Dataverse schema
    };

    if (params.updatedRFQ.purchaseRequestId) {
      rfqPayload["cr49f_PRRFQ@odata.bind"] = `/cr49f_purchaserequests(${cleanGuid(params.updatedRFQ.purchaseRequestId)})`;
    }

    try {
      await Cr49f_requestforqoutationsService.update(cleanRFQId, rfqPayload as any);
      console.log(`[ApprovalWorkflow] Updated RFQ ${cleanRFQId} to Pending (0)`);
    } catch (rfqUpdateErr) {
      console.warn(`[ApprovalWorkflow] Failed to update parent RFQ ${cleanRFQId}:`, rfqUpdateErr);
    }

    // Associate selected suppliers if provided
    if (params.selectedSupplierIds) {
      try {
        const [selRes, allSupRes] = await Promise.all([
          Cr49f_selectedsuppliersesService.getAll(),
          Cr49f_suppliersService.getAll(),
        ]);
        const existingSel = (selRes.data ?? []).filter(
          (s) => cleanGuid(s._cr49f_rfq_value) === cleanRFQId
        );
        const allSuppliers = allSupRes.data ?? [];

        const chosenSuppliers = allSuppliers.filter((s) =>
          params.selectedSupplierIds?.includes(s.cr49f_supplierid)
        );

        // 1. Add any newly selected suppliers not in existingSel
        for (const sup of chosenSuppliers) {
          const alreadyLinked = existingSel.some(
            (e) =>
              e.cr49f_selectedsuppliernumber === (sup.cr49f_supplierid1 || sup.cr49f_supplierid) ||
              e.cr49f_supplierquotation === sup.cr49f_name
          );
          if (!alreadyLinked) {
            try {
              await Cr49f_selectedsuppliersesService.create({
                "cr49f_RFQ@odata.bind": `/cr49f_requestforqoutations(${cleanRFQId})`,
                cr49f_selectedsuppliernumber: sup.cr49f_supplierid1 || sup.cr49f_supplierid || "SUP",
                cr49f_supplierquotation: sup.cr49f_name || "Invited Supplier",
                cr49f_responded: false,
                statecode: 0,
                statuscode: 1,
              });
            } catch (addSelErr) {
              console.warn("[ApprovalWorkflow] Could not create selected supplier:", addSelErr);
            }

            if (sup.cr49f_supplierid && !sup.cr49f_supplierid.startsWith("mock-")) {
              try {
                await Cr49f_suppliersService.update(sup.cr49f_supplierid, {
                  "cr49f_RFQSuppliers@odata.bind": `/cr49f_requestforqoutations(${cleanRFQId})`,
                });
              } catch { }
            }
          }
        }

        // 2. Remove unselected suppliers
        for (const es of existingSel) {
          const stillSelected = chosenSuppliers.some(
            (cs) =>
              (cs.cr49f_supplierid1 || cs.cr49f_supplierid) === es.cr49f_selectedsuppliernumber ||
              cs.cr49f_name === es.cr49f_supplierquotation
          );
          if (!stillSelected) {
            try {
              await Cr49f_selectedsuppliersesService.delete(es.cr49f_selectedsuppliersid);
            } catch (delSelErr) {
              console.warn("[ApprovalWorkflow] Could not remove unselected supplier:", delSelErr);
            }
          }
        }

        // 3. Update localStorage cache
        if (typeof window !== "undefined") {
          localStorage.setItem(`rfq_invited_suppliers_${cleanRFQId}`, JSON.stringify(chosenSuppliers));
        }

        // 4. Supplier responses will be initialized only when all RFQ tasks get approved
      } catch (supSyncErr) {
        console.warn("[ApprovalWorkflow] Error syncing suppliers for RFQ:", supSyncErr);
      }
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(`rfq_status_${cleanRFQId}`, "Pending");
      localStorage.removeItem(`rfq_changes_reason_${cleanRFQId}`);
    }
  }

  // 3. Mark the Changes Needed task as completed/inactive
  if (cleanTaskId) {
    try {
      await Cr49f_approvaltasksesService.update(cleanTaskId, {
        statecode: 1, // Inactive
        statuscode: 2, // Inactive
        cr49f_approvalstatus: 2 as any, // Resolved / Approved
        cr49f_approvedby: requester,
        cr49f_approvedon: nowIso,
      } as any);
    } catch (deactErr) {
      console.warn(`[ApprovalWorkflow] Could not mark Changes Needed task ${cleanTaskId} as inactive:`, deactErr);
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(`task_approved_status_${cleanTaskId}`, "Approved");
      localStorage.setItem(`task_active_${cleanTaskId}`, "false");
      localStorage.setItem(`task_approved_by_${cleanTaskId}`, requester);
      localStorage.setItem(`task_approved_on_${cleanTaskId}`, nowIso);

      if (params.requesterRemarks) {
        const revComment: TaskComment = {
          id: `c_${Date.now()}`,
          text: `Revisions submitted: ${params.requesterRemarks}`,
          author: requester,
          timestamp: new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }),
        };
        void updateTaskCommentsInDataverse(cleanTaskId, revComment, requester);
      }
    }
  }

  // 4. Restart approval workflow from the first approval level (Sequence #1 active, subsequent inactive pending)
  let allTasks: Cr49f_approvaltaskses[] = [];
  try {
    const allRes = await Cr49f_approvaltasksesService.getAll();
    allTasks = allRes.data ?? [];
  } catch (fetchErr) {
    console.warn("[ApprovalWorkflow] Failed to fetch tasks:", fetchErr);
  }

  const siblingTasks = allTasks.filter((t) => {
    const { prId: tPR, rfqId: tRFQ } = extractTaskParentIds(t);
    const tSeq = t.cr49f_sequence ?? 0;
    if (tSeq < 1) return false; // Only sequential approval tasks (sequence >= 1)

    if (cleanRFQId && tRFQ === cleanRFQId) return true;
    if (cleanPRId && tPR === cleanPRId) return true;
    return false;
  });

  siblingTasks.sort((a, b) => (a.cr49f_sequence ?? 0) - (b.cr49f_sequence ?? 0));

  let firstActivatedTask: Cr49f_approvaltaskses | null = null;

  if (siblingTasks.length > 0) {
    // 5. Activate Sequence #1 task
    const firstTask = siblingTasks[0];
    const firstId = cleanGuid(
      firstTask.cr49f_approvaltasksid ||
      (firstTask as unknown as Record<string, string>).cr49f_ApprovalTasksId
    );

    if (firstId) {
      try {
        const actRes = await Cr49f_approvaltasksesService.update(firstId, {
          statecode: 0, // Active
          statuscode: 1, // Active
          cr49f_approvalstatus: 1 as any, // Pending
          cr49f_assignedon: nowIso,
          cr49f_approvedby: "",
        } as any);
        if (actRes.data) firstActivatedTask = actRes.data;
      } catch (actErr) {
        console.warn(`[ApprovalWorkflow] Could not activate task 1 (${firstId}):`, actErr);
      }

      if (typeof window !== "undefined") {
        localStorage.setItem(`task_approved_status_${firstId}`, "Pending");
        localStorage.setItem(`task_active_${firstId}`, "true");
        localStorage.removeItem(`task_approved_by_${firstId}`);
        localStorage.removeItem(`task_approved_on_${firstId}`);
      }
      void setTaskApprovalStatusInDataverse(firstId, "Pending");

      if (params.requesterRemarks) {
        const revComment: TaskComment = {
          id: `c_${Date.now()}_seq1`,
          text: `Workflow restarted: ${params.requesterRemarks}`,
          author: requester,
          timestamp: new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }),
        };
        void updateTaskCommentsInDataverse(firstId, revComment, requester);
      }
    }

    // 6. Keep all subsequent tasks inactive with Approval Status = Pending
    for (let i = 1; i < siblingTasks.length; i++) {
      const subTask = siblingTasks[i];
      const subId = cleanGuid(
        subTask.cr49f_approvaltasksid ||
        (subTask as unknown as Record<string, string>).cr49f_ApprovalTasksId
      );
      if (!subId) continue;

      try {
        await Cr49f_approvaltasksesService.update(subId, {
          statecode: 1, // Inactive
          statuscode: 2, // Inactive
          cr49f_approvalstatus: 1 as any, // Pending
          cr49f_approvedby: "",
        } as any);
      } catch { }

      if (typeof window !== "undefined") {
        localStorage.setItem(`task_approved_status_${subId}`, "Pending");
        localStorage.setItem(`task_active_${subId}`, "false");
        localStorage.removeItem(`task_approved_by_${subId}`);
        localStorage.removeItem(`task_approved_on_${subId}`);
      }
      void setTaskApprovalStatusInDataverse(subId, "Pending");
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("approvalTasksUpdated"));
  }

  return {
    success: true,
    firstActivatedTask,
  };
}

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
      const { prId: prVal, rfqId: rfqVal, poId: poVal } = extractTaskParentIds(t);
      if (objectType === 1 && prVal === cleanId) return true;
      if (objectType === 2 && rfqVal === cleanId) return true;
      if (objectType === 3 && poVal === cleanId) return true;
      return false;
    });

    matched.sort((a, b) => (a.cr49f_sequence ?? 0) - (b.cr49f_sequence ?? 0));

    // Apply local storage overlay to ensure immediate status consistency, auto-heal DB, and activate sequence
    if (typeof window !== "undefined") {
      for (let i = 0; i < matched.length; i++) {
        const t = matched[i];
        const raw = t as unknown as Record<string, unknown>;
        const tId = cleanGuid(
          t.cr49f_approvaltasksid ||
          (raw.cr49f_ApprovalTasksId as string) ||
          (raw.id as string)
        );
        if (tId) {
          const cached = localStorage.getItem(`task_approved_status_${tId}`);
          const isParentChangesNeeded =
            (objectType === 1 && localStorage.getItem(`pr_status_${cleanId}`) === "Changes Needed") ||
            (objectType === 2 && localStorage.getItem(`rfq_status_${cleanId}`) === "Changes Needed");

          if (isParentChangesNeeded && (t.cr49f_sequence ?? 0) >= 1) {
            // Task has been reset to Pending and Inactive due to parent Changes Needed
            t.cr49f_approvalstatus = 1 as any;
            t.statecode = 1 as any;
            t.statuscode = 2 as any;
            t.cr49f_approvedby = "";
            t.cr49f_approvedon = "";
            delete (raw as any).cr49f_approvedby;
            delete (raw as any).cr49f_approvedon;
            localStorage.setItem(`task_approved_status_${tId}`, "Pending");
            localStorage.setItem(`task_active_${tId}`, "false");
            localStorage.removeItem(`task_approved_by_${tId}`);
            localStorage.removeItem(`task_approved_on_${tId}`);
          } else if (cached === "Changes Needed" || (t.cr49f_sequence ?? 0) === 0) {
            t.cr49f_approvalstatus = 4 as any;
          } else if (cached === "Rejected") {
            t.cr49f_approvalstatus = 3 as any;
            localStorage.setItem(`task_active_${tId}`, "false");
          } else if (
            cached === "Approved" ||
            (!isParentChangesNeeded &&
              (Number(t.cr49f_approvalstatus) === 2 || Boolean(t.cr49f_approvedby && t.cr49f_approvedon)))
          ) {
            t.cr49f_approvalstatus = 2 as any;
            localStorage.setItem(`task_active_${tId}`, "false");
            // Activate the next sequential task
            const nextSeqTask = matched.find(
              (s) => (s.cr49f_sequence ?? 0) > (t.cr49f_sequence ?? 0)
            );
            if (nextSeqTask) {
              nextSeqTask.statecode = 0;
              nextSeqTask.statuscode = 1;
              const nextTId = cleanGuid(
                nextSeqTask.cr49f_approvaltasksid ||
                (nextSeqTask as any).cr49f_ApprovalTasksId ||
                (nextSeqTask as any).id
              );
              if (nextTId) {
                localStorage.setItem(`task_active_${nextTId}`, "true");
              }
            }
          } else {
            // Normal Pending task
            t.cr49f_approvalstatus = 1 as any;
            if ((t.cr49f_sequence ?? 0) === 1 && !isParentChangesNeeded) {
              t.statecode = 0;
              t.statuscode = 1;
              localStorage.setItem(`task_active_${tId}`, "true");
            }
          }

          const cachedApprovedBy = localStorage.getItem(`task_approved_by_${tId}`);
          if (cachedApprovedBy && !t.cr49f_approvedby) {
            t.cr49f_approvedby = cachedApprovedBy;
          }
          const cachedApprovedOn = localStorage.getItem(`task_approved_on_${tId}`);
          if (cachedApprovedOn && !t.cr49f_approvedon) {
            t.cr49f_approvedon = cachedApprovedOn;
          }
          const cachedAssignedOn = localStorage.getItem(`task_assigned_on_${tId}`);
          if (cachedAssignedOn && !t.cr49f_assignedon) {
            t.cr49f_assignedon = cachedAssignedOn;
          }

          const dbComments = t.cr49f_comments ?? (raw as any).cr49f_comments ?? (raw as any).cr49f_Comments;
          if (dbComments) {
            t.cr49f_comments = dbComments;
            const parsed = parseTaskComments(dbComments);
            if (parsed.length > 0) {
              localStorage.setItem(`task_comments_${tId}`, JSON.stringify(parsed));
            }
          }
        }
      }
    }

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
): "Pending" | "Approved" | "Rejected" | "Changes Needed" {
  const raw = task as unknown as Record<string, unknown>;
  const cleanId = cleanGuid(
    task.cr49f_approvaltasksid ||
    (raw.cr49f_ApprovalTasksId as string) ||
    (raw.id as string)
  );

  // 0. Fast local storage cache check for immediate reactivity
  if (cleanId && typeof window !== "undefined") {
    const cached = localStorage.getItem(`task_approved_status_${cleanId}`);
    if (
      cached === "Approved" ||
      cached === "Rejected" ||
      cached === "Pending" ||
      cached === "Changes Needed"
    ) {
      return cached as "Pending" | "Approved" | "Rejected" | "Changes Needed";
    }
  }

  // 0b. If parent PR or RFQ is in Changes Needed status, any sequential task (>= 1) is strictly Pending
  const parentPRVal = cleanGuid(task._cr49f_pr_value || (raw._cr49f_PR_value as string) || (raw.cr49f_pr as string));
  const parentRFQVal = cleanGuid(task._cr49f_rfq_value || (raw._cr49f_RFQ_value as string) || (raw.cr49f_rfq as string));
  if (typeof window !== "undefined") {
    const prStatus = parentPRVal ? localStorage.getItem(`pr_status_${parentPRVal}`) : null;
    const rfqStatus = parentRFQVal ? localStorage.getItem(`rfq_status_${parentRFQVal}`) : null;
    if ((prStatus === "Changes Needed" || rfqStatus === "Changes Needed") && (task.cr49f_sequence ?? 0) >= 1) {
      return "Pending";
    }
  }

  // 1. Check formatted OData string or virtual display name field (most authoritative from Dataverse)
  const formattedVal =
    (raw["cr49f_approvalstatus@OData.Community.Display.V1.FormattedValue"] as string) ||
    (raw["cr49f_ApprovalStatus@OData.Community.Display.V1.FormattedValue"] as string) ||
    (raw["cr49f_approvalstatusname"] as string) ||
    (raw["_cr49f_approvalstatus_value@OData.Community.Display.V1.FormattedValue"] as string);

  if (formattedVal && typeof formattedVal === "string") {
    const fStr = formattedVal.trim().toLowerCase();
    if (fStr.includes("approv")) return "Approved";
    if (fStr.includes("reject")) return "Rejected";
    if (fStr.includes("change")) return "Changes Needed";
    if (fStr.includes("pend")) return "Pending";
  }

  // 2. Check cr49f_approvalstatus value
  const statusVal = task.cr49f_approvalstatus ?? raw.cr49f_ApprovalStatus ?? raw.cr49f_approvalstatus;
  if (statusVal !== undefined && statusVal !== null) {
    if (typeof statusVal === "string") {
      const s = statusVal.trim().toLowerCase();
      if (s.includes("approv")) return "Approved";
      if (s.includes("reject")) return "Rejected";
      if (s.includes("change")) return "Changes Needed";
      if (s.includes("pend")) return "Pending";
    }

    if (typeof statusVal === "number") {
      // Dataverse Choice 4 = Changes Needed
      if (statusVal === 4 || statusVal === 154890003 || statusVal === 100000003) {
        return "Changes Needed";
      }

      // Publisher prefix 15489xxxxx
      if (statusVal === 154890001) return "Approved";
      if (statusVal === 154890002) return "Rejected";
      if (statusVal === 154890000) return "Pending";

      // Dataverse default prefix 100000000
      if (statusVal === 100000001) return "Approved";
      if (statusVal === 100000002) return "Rejected";
      if (statusVal === 100000000) return "Pending";

      // Exact Dataverse Choices (1=Pending, 2=Approved, 3=Rejected)
      if (statusVal === 2) return "Approved";
      if (statusVal === 3) return "Rejected";
      if (statusVal === 1) return "Pending";
      if (statusVal === 0) return "Pending";
    }
  }

  // 3. Check sequence or task name for changes needed task
  if (
    (task.cr49f_sequence ?? 0) === 0 ||
    (task.cr49f_task && task.cr49f_task.toLowerCase().includes("changes needed"))
  ) {
    return "Changes Needed";
  }

  // 4. If approvedby and approvedon are populated in Dataverse, the task was approved!
  if (task.cr49f_approvedby || task.cr49f_approvedon || raw.cr49f_approvedby || raw.cr49f_approvedon) {
    return "Approved";
  }

  // 5. Fallback to cr49f_id ONLY if explicitly string "Approved" or "Rejected" or "Changes Needed"
  if (task.cr49f_id === "Approved") return "Approved";
  if (task.cr49f_id === "Rejected") return "Rejected";
  if (task.cr49f_id === "Changes Needed") return "Changes Needed";

  // 6. Default: any task not explicitly approved or rejected is Pending!
  return "Pending";
}


/**
 * Scans all existing PRs and RFQs in Dataverse,
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
        const tPR =
          cleanGuid(t._cr49f_pr_value) ||
          cleanGuid(raw._cr49f_PR_value as string) ||
          cleanGuid(raw.cr49f_pr as string) ||
          cleanGuid(raw.cr49f_PR as string);
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
        const tRFQ =
          cleanGuid(t._cr49f_rfq_value) ||
          cleanGuid(raw._cr49f_RFQ_value as string) ||
          cleanGuid(raw.cr49f_rfq as string) ||
          cleanGuid(raw.cr49f_RFQ as string);
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
      updateTaskCommentsInDataverse: typeof updateTaskCommentsInDataverse;
      addTaskComment: typeof addTaskComment;
      parseTaskComments: typeof parseTaskComments;
    };
  }).approvalWorkflow = {
    createApprovalTasksForObject,
    approveTask,
    rejectTask,
    getApprovalTasksForRecord,
    getTaskApprovalStatusLabel,
    syncAllPendingApprovalTasks,
    updateTaskCommentsInDataverse,
    addTaskComment,
    parseTaskComments,
  };
}
