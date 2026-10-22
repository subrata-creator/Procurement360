
// src/Services/Serviceline.ts

const TOKEN_FLOW_URL = "https://d342b72949aaebca8ede9a148dc57d.52.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/09/workflows/262f42a6a5734f71b1ac6b580058d00f/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=nncXCYGYMyZdnYWsLm1DxTmH8jYibreWjl4Wk83U5ME";

const DIRECTLINE_BASE =
  "https://europe.directline.botframework.com/v3/directline";

export interface Choice {
  label: string;
  value: string;
}

export interface DirectLineActivity {
  type?: string;
  id?: string;
  from?: {
    id?: string;
    name?: string;
  };
  text?: string;
  name?: string;
  suggestedActions?: {
    actions?: {
      type?: string;
      title?: string;
      value?: unknown;
    }[];
  };
  attachments?: {
    contentType?: string;
    content?: unknown;
  }[];
  [key: string]: unknown;
}

interface TokenResponse {
  token?: string;
  conversationId?: string;
  expires_in?: number;
  body?: {
    token?: string;
    conversationId?: string;
    expires_in?: number;
  };
}

interface ActivitiesResponse {
  activities?: DirectLineActivity[];
  watermark?: string;
}

async function getErrorDetails(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return response.statusText;
  }
}

/**
 * Extract choices dynamically from suggested actions or Adaptive Cards.
 */
export function extractChoices(
  activity: DirectLineActivity
): Choice[] {
  const actions = activity.suggestedActions?.actions;

  if (Array.isArray(actions)) {
    const choices = actions
      .map((action): Choice | null => {
        const label =
          typeof action.title === "string"
            ? action.title
            : undefined;

        const value =
          typeof action.value === "string"
            ? action.value
            : typeof action.value === "number"
              ? String(action.value)
              : label;

        return label && value ? { label, value } : null;
      })
      .filter((choice): choice is Choice => choice !== null);

    if (choices.length > 0) {
      return choices;
    }
  }

  for (const attachment of activity.attachments ?? []) {
    if (
      attachment.contentType !==
      "application/vnd.microsoft.card.adaptive"
    ) {
      continue;
    }

    const content = attachment.content;

    if (!content || typeof content !== "object") {
      continue;
    }

    const body = (
      content as Record<string, unknown>
    ).body;

    if (!Array.isArray(body)) {
      continue;
    }

    for (const element of body) {
      if (!element || typeof element !== "object") {
        continue;
      }

      const item = element as Record<string, unknown>;

      if (item.type !== "Input.ChoiceSet") {
        continue;
      }

      const rawChoices = item.choices;

      if (!Array.isArray(rawChoices)) {
        continue;
      }

      const choices = rawChoices
        .map((choice): Choice | null => {
          if (!choice || typeof choice !== "object") {
            return null;
          }

          const item = choice as Record<string, unknown>;
          const label = item.title;
          const value = item.value;

          if (
            typeof label !== "string" ||
            (typeof value !== "string" &&
              typeof value !== "number")
          ) {
            return null;
          }

          return {
            label,
            value: String(value),
          };
        })
        .filter((choice): choice is Choice => choice !== null);

      if (choices.length > 0) {
        return choices;
      }
    }
  }

  return [];
}

export class DirectLineSession {
  private readonly token: string;
  private readonly conversationId: string;
  private watermark: string | undefined;

  private constructor(token: string, conversationId: string) {
    this.token = token;
    this.conversationId = conversationId;
  }

  /**
   * Obtain the token and conversation ID from the Power Automate flow.
   * The flow has already generated the conversation ID, so do not
   * create another conversation here.
   */
  static async start(): Promise<DirectLineSession> {
    const tokenResponse = await fetch(TOKEN_FLOW_URL, {
      method: "POST",
    });

    if (!tokenResponse.ok) {
      const details = await getErrorDetails(tokenResponse);

      throw new Error(
        `Token flow failed (${tokenResponse.status}): ${details}`
      );
    }

    const result =
      (await tokenResponse.json()) as TokenResponse;

    // Support both a direct response and a wrapped Power Automate response.
    const payload = result.body ?? result;

    const token = payload.token;
    const conversationId = payload.conversationId;

    if (!token || !conversationId) {
      throw new Error(
        "Token flow response must contain both token and conversationId."
      );
    }

    const session = new DirectLineSession(
      token,
      conversationId
    );

    // Start the bot's greeting topic.
    await session.postActivity({
      type: "event",
      name: "startConversation",
      value: {},
    });

    return session;
  }

  async postActivity(
    activity: DirectLineActivity
  ): Promise<void> {
    const response = await fetch(
      `${DIRECTLINE_BASE}/conversations/${this.conversationId}/activities`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...activity,
          from: activity.from ?? { id: "user" },
        }),
      }
    );

    if (!response.ok) {
      const details = await getErrorDetails(response);

      throw new Error(
        `Could not post activity (${response.status}): ${details}`
      );
    }
  }

  private async pollOnce(): Promise<DirectLineActivity[]> {
    const url = new URL(
      `${DIRECTLINE_BASE}/conversations/${this.conversationId}/activities`
    );

    if (this.watermark) {
      url.searchParams.set("watermark", this.watermark);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      const details = await getErrorDetails(response);

      throw new Error(
        `Could not fetch activities (${response.status}): ${details}`
      );
    }

    const data =
      (await response.json()) as ActivitiesResponse;

    this.watermark = data.watermark ?? this.watermark;

    return data.activities ?? [];
  }

  /**
   * Wait for a bot message and return the activities received.
   */
  async waitForBotReply(
    timeoutMs = 20000,
    intervalMs = 1000
  ): Promise<DirectLineActivity[]> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const activities = await this.pollOnce();

      const botActivities = activities.filter(
        (activity) =>
          activity.type === "message" &&
          activity.from?.id !== "user"
      );

      if (botActivities.length > 0) {
        return botActivities;
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, intervalMs);
      });
    }

    throw new Error(
      "Timed out waiting for a response from the agent."
    );
  }
}
