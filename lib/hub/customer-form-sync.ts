type AnswerValue = string | number | boolean | null | undefined;

export interface CustomerFormUpdates {
  name?: string;
  dateOfBirth?: Date;
  phone?: string;
  address?: string;
}

function cleanText(value: AnswerValue): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseDateOnly(value: AnswerValue): Date | undefined {
  const text = cleanText(value);
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return undefined;
  }

  const date = new Date(`${text}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function deriveCustomerUpdatesFromFormAnswers(
  answers: Record<string, AnswerValue>
): CustomerFormUpdates {
  const updates: CustomerFormUpdates = {};
  const name = cleanText(answers.fullName);
  const dateOfBirth = parseDateOnly(answers.dob);
  const phone = cleanText(answers.phone);
  const address = cleanText(answers.address);

  if (name) updates.name = name;
  if (dateOfBirth) updates.dateOfBirth = dateOfBirth;
  if (phone) updates.phone = phone;
  if (address) updates.address = address;

  return updates;
}
