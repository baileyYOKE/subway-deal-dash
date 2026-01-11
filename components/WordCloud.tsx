import React, { useMemo } from 'react';
import { WordCloudItem } from '../services/commentsService';

interface Props {
    words: WordCloudItem[];
    width?: number;
    height?: number;
}

// Color palette - Subway green gradient
const COLORS = [
    '#00a94f', // Subway green
    '#2ecc71',
    '#27ae60',
    '#1abc9c',
    '#16a085',
    '#00d46a',
    '#7ed957',
    '#00ff88'
];

export const WordCloud: React.FC<Props> = ({ words, width = 600, height = 400 }) => {
    // Calculate font sizes based on word frequency
    const processedWords = useMemo(() => {
        if (words.length === 0) return [];

        const maxValue = Math.max(...words.map(w => w.value));
        const minValue = Math.min(...words.map(w => w.value));
        const range = maxValue - minValue || 1;

        return words.slice(0, 60).map((word, index) => {
            // Scale font size between 14 and 48
            const normalized = (word.value - minValue) / range;
            const fontSize = 14 + normalized * 34;

            // Randomize position within bounds
            const angle = (index * 137.5) % 360; // Golden angle for distribution
            const radius = 0.3 + (normalized * 0.15) + (Math.random() * 0.15);
            const x = 50 + Math.cos((angle * Math.PI) / 180) * radius * 40;
            const y = 50 + Math.sin((angle * Math.PI) / 180) * radius * 35;

            // Slight rotation for visual interest
            const rotation = (Math.random() - 0.5) * 20;

            return {
                ...word,
                fontSize,
                x: `${Math.max(10, Math.min(90, x))}%`,
                y: `${Math.max(15, Math.min(85, y))}%`,
                rotation,
                color: COLORS[index % COLORS.length],
                opacity: 0.7 + normalized * 0.3
            };
        });
    }, [words]);

    if (words.length === 0) {
        return (
            <div
                className="flex items-center justify-center bg-gray-800 rounded-2xl border border-gray-700"
                style={{ width, height }}
            >
                <p className="text-gray-500">No word data available</p>
            </div>
        );
    }

    return (
        <div
            className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl border border-gray-700 overflow-hidden"
            style={{ width: '100%', height, maxWidth: width }}
        >
            {/* Background glow */}
            <div
                className="absolute inset-0 bg-gradient-radial from-subway-green/10 to-transparent"
                style={{ background: 'radial-gradient(circle at center, rgba(0,169,79,0.1) 0%, transparent 70%)' }}
            />

            {/* Words */}
            {processedWords.map((word, index) => (
                <span
                    key={word.text}
                    className="absolute font-bold transition-all duration-300 hover:scale-110 cursor-default select-none"
                    style={{
                        left: word.x,
                        top: word.y,
                        fontSize: `${word.fontSize}px`,
                        color: word.color,
                        opacity: word.opacity,
                        transform: `translate(-50%, -50%) rotate(${word.rotation}deg)`,
                        textShadow: `0 0 10px ${word.color}40`,
                        animation: `fadeIn 0.5s ease-out ${index * 0.02}s both`
                    }}
                    title={`"${word.text}" - ${word.value} mentions`}
                >
                    {word.text}
                </span>
            ))}

            {/* CSS Animation */}
            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
        </div>
    );
};

export default WordCloud;
