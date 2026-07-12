export type DetectedNotification = {
  id: string;
  packageName: string;
  amount: number;
  type: 'income' | 'expense';
  // Raw notification fields, kept alongside the parsed amount/type for
  // on-device debugging — lets a parse be sanity-checked against what the
  // notification actually said.
  title: string;
  text: string;
  postedAt: number;
};
