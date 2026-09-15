const DATA_URL = './data/kotegawa_history.json';

export async function fetchHistoryData() {
    try {
        //?v vacia cache
        const response = await fetch(`${DATA_URL}?v=${new Date().getTime()}`);
        if (!response.ok) {
            throw new Error('Error HTTP: ${response.status}');
        }
        const data = await response.json();
        return data;
    }
    catch (error) {
        console.error("Error al obtener datos de señales", error);
        return null;
    }
}