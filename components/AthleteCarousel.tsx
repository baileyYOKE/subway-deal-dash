import React from 'react';
import { Athlete } from '../types';

export interface AthleteImage {
    firstName: string;
    lastName: string;
    schoolName: string;
    sport: string;
    imageUrl: string;
    athlete?: Athlete; // Original athlete data for click handler
}

interface Props {
    athletes: AthleteImage[];
    onAthleteClick?: (athlete: Athlete) => void;
}

// Single row of the carousel - uses CSS animation for seamless infinite loop
const CarouselRow: React.FC<{
    athletes: AthleteImage[];
    direction: 'left' | 'right';
    duration?: number;
    onAthleteClick?: (athlete: Athlete) => void;
}> = ({ athletes, direction, duration = 60, onAthleteClick }) => {
    // Duplicate athletes once - when first half scrolls out, second half continues seamlessly
    const displayAthletes = [...athletes, ...athletes];

    return (
        <div className="overflow-hidden py-2">
            <div
                className="flex gap-3"
                style={{
                    animation: `scroll-${direction} ${duration}s linear infinite`,
                    width: 'fit-content'
                }}
            >
                {displayAthletes.map((athlete, idx) => (
                    <div
                        key={`${athlete.firstName}-${athlete.lastName}-${idx}`}
                        className="flex-shrink-0 group relative cursor-pointer"
                        onClick={() => athlete.athlete && onAthleteClick?.(athlete.athlete)}
                    >
                        <div className="w-24 h-24 rounded-full overflow-hidden border-3 border-subway-green/40 hover:border-subway-green shadow-lg hover:shadow-xl transition-all hover:scale-110 bg-white">
                            <img
                                src={athlete.imageUrl}
                                alt={`${athlete.firstName} ${athlete.lastName}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        </div>

                        {/* Tooltip on hover */}
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-lg">
                                {athlete.firstName} {athlete.lastName}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* CSS Animation Keyframes */}
            <style>{`
                @keyframes scroll-left {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                @keyframes scroll-right {
                    0% { transform: translateX(-50%); }
                    100% { transform: translateX(0); }
                }
            `}</style>
        </div>
    );
};

export const AthleteCarousel: React.FC<Props> = ({ athletes, onAthleteClick }) => {
    if (athletes.length === 0) return null;

    // Each row gets the same full list of athletes - CSS animation handles the loop
    // This ensures each belt is always full
    return (
        <div className="relative overflow-hidden py-4">
            {/* Gradient overlays for fade effect - light theme */}
            <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white via-white/80 to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white via-white/80 to-transparent z-10 pointer-events-none" />

            {/* Three rows - each has all athletes, different speeds/directions */}
            <CarouselRow athletes={athletes} direction="left" duration={200} onAthleteClick={onAthleteClick} />
            <CarouselRow athletes={athletes} direction="right" duration={220} onAthleteClick={onAthleteClick} />
            <CarouselRow athletes={athletes} direction="left" duration={240} onAthleteClick={onAthleteClick} />
        </div>
    );
};

// CSV Parser for the subway_deal_with_images.csv format
export const parseAthleteImageCSV = (csvText: string): AthleteImage[] => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    // Parse header to get column indices
    const header = lines[0].split(',');
    const firstNameIdx = header.findIndex(h => h.toLowerCase().includes('firstname'));
    const lastNameIdx = header.findIndex(h => h.toLowerCase().includes('lastname'));
    const schoolNameIdx = header.findIndex(h => h.toLowerCase().includes('schoolname'));
    const sportIdx = header.findIndex(h => h.toLowerCase().includes('sport'));
    const imageUrlIdx = header.findIndex(h => h.toLowerCase().includes('imageurl'));
    const hasImageIdx = header.findIndex(h => h.toLowerCase().includes('hasimage'));

    const athletes: AthleteImage[] = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        // Handle CSV with potential commas in quoted fields
        const parts: string[] = [];
        let current = '';
        let inQuotes = false;

        for (const char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                parts.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        parts.push(current);

        // Only include if hasImage is YES and imageUrl exists
        const hasImage = parts[hasImageIdx]?.trim();
        const imageUrl = parts[imageUrlIdx]?.trim();

        // Exclude known placeholder/logo images
        const EXCLUDE_PATTERNS = [
            'headshot_default',
            'Coyote.jpg',
            '/setup/',
            'placeholder',
            'default.jpg',
            'default.png',
            'logo',
            'mascot'
        ];
        const isExcluded = EXCLUDE_PATTERNS.some(p => imageUrl?.toLowerCase().includes(p.toLowerCase()));

        if (hasImage === 'YES' && imageUrl && imageUrl.startsWith('http') && !isExcluded) {
            athletes.push({
                firstName: parts[firstNameIdx]?.trim() || '',
                lastName: parts[lastNameIdx]?.trim() || '',
                schoolName: parts[schoolNameIdx]?.trim() || '',
                sport: parts[sportIdx]?.trim() || '',
                imageUrl: imageUrl
            });
        }
    }

    return athletes;
};

// Helper to convert Athlete[] to AthleteImage[] for the carousel
export const athletesToCarouselImages = (athletes: Athlete[]): AthleteImage[] => {
    return athletes
        .filter(a => a.profile_image_url && a.profile_image_url.startsWith('http'))
        .filter(a => !a.user_name.startsWith('Video_Athlete_') && !a.user_name.startsWith('Story_Athlete_'))
        .map(a => {
            const nameParts = a.user_name.split(' ');
            return {
                firstName: nameParts[0] || '',
                lastName: nameParts.slice(1).join(' ') || '',
                schoolName: '',
                sport: '',
                imageUrl: a.profile_image_url,
                athlete: a
            };
        });
};

export default AthleteCarousel;
