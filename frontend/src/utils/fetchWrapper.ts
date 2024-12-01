// src/utils/fetchWrapper.ts

import { useUserdataStore } from '@/stores/userdata';

async function fetchWrapper(url: string, options: RequestInit = {}): Promise<any> {
    const { logout } = useUserdataStore();

    return new Promise((resolve, reject) => {
      fetch(url, options)
        .then(async response => {
          // auto logout if 401 response returned from api
          if (response.status === 401 || response.status === 403) {
            await logout()
            try {
              const errorData = await response.json()
              reject(
                new Error(
                  errorData.message ||
                    errorData.error ||
                    'Unauthorized: Invalid JSON response',
                ),
              )
            } catch (jsonError) {
              reject(new Error('Unauthorized: Invalid JSON response'))
            }
          }

          if (!response.ok) {
            try {
              const errorData = await response.json()
              return reject(new Error(errorData.message))
            } catch (jsonError) {
              return reject(new Error('Failed: Invalid JSON response'))
            }
          }

          return resolve(await response.json())
        })
        .catch(error => {
          return reject(new Error(error))
        })
    })
}

export default fetchWrapper;