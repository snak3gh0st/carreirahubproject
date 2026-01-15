/**
 * Export CSV Utility
 * Converts array of objects to CSV format and triggers browser download
 */

/**
 * Converts an array of objects to CSV format with UTF-8 BOM for Excel compatibility
 * @param data Array of objects to convert
 * @param filename Name of the file to download
 */
export function exportToCSV(data: Array<Record<string, any>>, filename: string): void {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }

  // Extract headers from first object
  const headers = Object.keys(data[0]);

  // Create CSV header row
  const csvHeader = headers.join(",");

  // Create CSV data rows
  const csvRows = data.map((row) => {
    return headers
      .map((header) => {
        const value = row[header];

        // Handle null/undefined
        if (value === null || value === undefined) {
          return "";
        }

        // Convert to string
        let stringValue = String(value);

        // Escape quotes by doubling them
        stringValue = stringValue.replace(/"/g, '""');

        // Wrap in quotes if contains comma, quote, or newline
        if (
          stringValue.includes(",") ||
          stringValue.includes('"') ||
          stringValue.includes("\n")
        ) {
          stringValue = `"${stringValue}"`;
        }

        return stringValue;
      })
      .join(",");
  });

  // Combine header and rows
  const csvContent = [csvHeader, ...csvRows].join("\n");

  // Add UTF-8 BOM for Excel compatibility
  const BOM = "\uFEFF";
  const csvWithBOM = BOM + csvContent;

  // Create Blob
  const blob = new Blob([csvWithBOM], { type: "text/csv;charset=utf-8;" });

  // Create download link
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Formats a date as YYYY-MM-DD for filename usage
 */
export function getDateStamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
