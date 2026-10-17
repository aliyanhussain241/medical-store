export function businessDay(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}
export const businessMonthStart = () => `${businessDay().slice(0, 7)}-01`;
