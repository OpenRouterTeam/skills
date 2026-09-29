export type Criterion = string | Record<string, unknown> | unknown[];

export type DecisionsState = string | Record<string, unknown> | unknown[];

export type NoulQuestion = {
  type: "noul";
  instructions: Criterion;
  criteria?: { true: Criterion; false: Criterion };
};

export type DecisionsRequest = {
  model: string;
  state: DecisionsState;
  questions: Record<string, NoulQuestion>;
  session_id?: string;
  user?: string;
};

export type NoulAnswer = {
  type: "noul";
  noul: number;
};

export type DecisionsResponse = {
  id?: string;
  model: string;
  provider?: string;
  answers: Record<string, NoulAnswer>;
  usage: { input_tokens: number; output_tokens: number; cost?: number };
};
