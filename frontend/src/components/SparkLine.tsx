interface SparklineProps {
    data: number[];
    colorClass: string; // Ej: "text-accent" o "text-danger"
}

const Sparkline = ({ data, colorClass }: SparklineProps) => {
    // Si no hay datos suficientes, no dibujamos nada
    if (!data || data.length < 2) return null;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1; // El "|| 1" evita dividir por cero si la acción no se movió

    // Tamaño base del lienzo virtual (se escalará con Tailwind)
    const svgWidth = 100;
    const svgHeight = 30;

    // Mapear los precios a coordenadas (X, Y)
    const points = data.map((price, index) => {
        // X avanza de forma pareja según el índice (0 a 100)
        const x = (index / (data.length - 1)) * svgWidth;

        // Y se calcula según el precio. 
        // IMPORTANTE: En SVG, la coordenada Y=0 es la parte SUPERIOR de la pantalla,
        // por lo que debemos invertir el cálculo (height - valor).
        const y = svgHeight - ((price - min) / range) * svgHeight;

        return `${x},${y}`;
    }).join(' ');

    return (
        // El viewBox tiene un pequeño margen (-2 y 34) para que la línea no se ampute en los bordes
        <svg className={`w-full h-full ${colorClass}`} viewBox="-2 -2 104 34" preserveAspectRatio="none">
            <polyline
                points={points}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    );
};
export default Sparkline;