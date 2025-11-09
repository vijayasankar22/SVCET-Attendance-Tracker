import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import * as XLSX from 'xlsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function exportToXlsx(filename: string, rows: any[]) {
    if (!rows || rows.length === 0) {
        return;
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Records");

    // Adjust column widths
    const objectMaxLength = [] as number[];
    rows.forEach(row => {
        Object.values(row).forEach((value, i) => {
            const val = value ? String(value) : '';
            objectMaxLength[i] = Math.max(objectMaxLength[i] || 0, val.length);
        });
    });
    const wscols = objectMaxLength.map(w => ({ wch: w + 2 })); // Add a little padding
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, filename);
}


export function exportToCsv(filename: string, rows: any[]) {
  if (!rows || rows.length === 0) {
    return;
  }

  const separator = ',';
  const keys = Object.keys(rows[0]);
  const csvContent =
    keys.join(separator) +
    '\n' +
    rows.map(row => {
      return keys.map(k => {
        let cell = row[k] === null || row[k] === undefined ? '' : row[k];
        cell = cell instanceof Date
          ? cell.toLocaleString()
          : cell.toString().replace(/"/g, '""');
        if (cell.search(/("|,|\n)/g) >= 0) {
          cell = `"${cell}"`;
        }
        return cell;
      }).join(separator);
    }).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
