import React from 'react';
import { Star, Heart, Tag } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { SpecialOffer, isOfferActive } from '../services/listingService';

interface ListingCardProps {
  id: string;
  title: string;
  location: string;
  price: number;
  rating: number;
  image: string;
  distance?: string;
  dates?: string;
  residenceType?: string;
  specialOffer?: SpecialOffer | null;
}

const ListingCard: React.FC<ListingCardProps> = ({ 
  id, 
  title, 
  location, 
  price, 
  rating, 
  image, 
  distance, 
  dates,
  residenceType,
  specialOffer
}) => {
  const hasActiveDeal = isOfferActive(specialOffer);
  const offer = hasActiveDeal ? specialOffer : null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="group cursor-pointer"
    >
      <Link to={`/listing/${id}`}>
        <div className="relative aspect-square overflow-hidden rounded-xl mb-3 bg-gray-100">
          <img 
            src={image} 
            alt={title} 
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
            referrerPolicy="no-referrer"
          />
          
          {/* Top Left: Residence Type Badge */}
          {residenceType && (
            <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs text-gray-800 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs capitalize">
              {residenceType}
            </span>
          )}

          {/* Top Right: Special Offer Badge if Active */}
          {offer && (
            <div className="absolute top-3 right-12 bg-gradient-to-r from-emerald-600 to-teal-700 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
              <Tag size={10} />
              <span>{offer.offerName || `${offer.discountPercent}% OFF`}</span>
            </div>
          )}

          <button 
            className="absolute top-3 right-3 text-white/80 hover:text-[#009A60] transition-colors" 
            onClick={(e) => e.preventDefault()}
          >
            <Heart size={22} fill="rgba(0,0,0,0.3)" />
          </button>
        </div>
        
        <div className="flex justify-between items-start">
          <h3 className="font-semibold text-gray-900 truncate pr-2">{location}</h3>
          <div className="flex items-center gap-1 shrink-0">
            <Star size={14} fill="currentColor" className="text-gray-900" />
            <span className="text-sm text-gray-900">{rating.toFixed(1)}</span>
          </div>
        </div>
        
        <p className="text-gray-500 text-sm truncate">{title}</p>
        <p className="text-gray-500 text-xs mt-0.5">{dates || 'Flexible dates available'}</p>
        
        {/* Pricing line: Strikethrough if active special offer */}
        {offer && offer.specialPrice > 0 ? (
          <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
            <span className="line-through text-gray-400 text-xs font-medium">
              MZN {price.toLocaleString()}
            </span>
            <span className="font-extrabold text-emerald-700 text-base">
              MZN {offer.specialPrice.toLocaleString()}
            </span>
            <span className="text-[10px] font-extrabold text-white bg-[#009A60] px-1.5 py-0.5 rounded">
              {offer.discountPercent}% OFF
            </span>
            <span className="text-gray-600 text-xs">/ night</span>
          </div>
        ) : (
          <p className="mt-1.5">
            <span className="font-semibold text-gray-900">MZN {price.toLocaleString()}</span>
            <span className="text-gray-900 text-sm"> / night</span>
          </p>
        )}
      </Link>
    </motion.div>
  );
}

export default ListingCard;
