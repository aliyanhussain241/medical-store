let epoch = 0;
export const sessionEpoch = () => epoch;
export function clearSession() {
  epoch += 1;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}
