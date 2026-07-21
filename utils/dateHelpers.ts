export const formatDisplayDate = (dateString: string) => {
  if (!dateString) return '';
  const dateParts = dateString.split('-');
  if (dateParts.length !== 3) return dateString;

  const year = dateParts[0];
  const month = parseInt(dateParts[1], 10);
  const day = parseInt(dateParts[2], 10);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  if (isNaN(month) || month < 1 || month > 12) return dateString;
  
  return `${day} ${months[month - 1]} ${year}`;
};
export const formatDateToISO = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
