export function getUserEmail(headers) {
  return headers.get('cf-access-authenticated-user-email');
}

export function isAuthorized(email) {
  const allow = ['admin@loxleyai.io'];
  return email ? allow.includes(email) : false;
}
