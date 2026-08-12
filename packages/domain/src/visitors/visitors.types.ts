export type VisitorRecord = {
  id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
};

export type VisitorResponse = {
  success: boolean;
  data?: VisitorRecord;
  error?: string;
};
