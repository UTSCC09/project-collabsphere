// src/utils/fetchWrapper.ts

import { useUserdataStore } from '@/stores/userdata';

async function fetchWrapper(url: string, options: RequestInit = {}): Promise<any> {
    const { logout } = useUserdataStore();

    return new Promise((resolve, reject) => fetch(url, options).then(
        async (response) =>  {
            // auto logout if 401 response returned from api
            if (response.status === 401 || response.status === 403) {
                await logout();
                try {
                    const errorData = await response.json();
                    reject({ ...errorData, cserror: 'unauthorized' });
                } catch (jsonError) {
                    reject({ cserror: 'unauthorized', message: 'Invalid JSON response' });
                }
            }
    
            if (!response.ok) {
                try {
                const errorData = await response.json();
                return reject(errorData);
                } catch (jsonError) {
                return reject({ message: 'Invalid JSON response' });
                }
            }

            return resolve(await response.json());
        }
    ));
}

export default fetchWrapper;