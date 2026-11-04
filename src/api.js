export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      credentials: 'include',
      method: options.method || 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError('Não consegui falar com o caderno.', 0);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error || 'Algo deu errado.', response.status);
  return data;
}

export const api = {
  me: async () => {
    const response = await fetch('/api/auth/me', { credentials: 'include' });
    if (response.status === 401) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(data.error || 'Algo deu errado.', response.status);
    return data.user;
  },
  login: (body) => request('/api/auth/login', { method: 'POST', body }).then((data) => data.user),
  register: (body) => request('/api/auth/register', { method: 'POST', body }).then((data) => data.user),
  logout: async () => {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch {
      /* a tela segue para o login mesmo se a rede falhar */
    }
  },
  password: (body) => request('/api/auth/password', { method: 'POST', body }),
  flavors: () => request('/api/flavors').then((data) => data.flavors),
  createFlavor: (body) => request('/api/flavors', { method: 'POST', body }).then((data) => data.flavor),
  updateFlavor: (id, body) => request(`/api/flavors/${id}`, { method: 'PATCH', body }).then((data) => data.flavor),
  deleteFlavor: (id) => request(`/api/flavors/${id}`, { method: 'DELETE' }),
  pickups: () => request('/api/pickups').then((data) => data.pickups),
  createPickups: (body) => request('/api/pickups', { method: 'POST', body }).then((data) => data.pickups),
  updatePickup: (id, body) => request(`/api/pickups/${id}`, { method: 'PATCH', body }).then((data) => data.pickup),
  deletePickup: (id) => request(`/api/pickups/${id}`, { method: 'DELETE' }),
  settle: (ids) => request('/api/pickups/settle', { method: 'POST', body: { ids } }),
};
