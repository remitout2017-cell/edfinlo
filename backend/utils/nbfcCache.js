// utils/nbfcCache.js

const NodeCache = require('node-cache');
const NBFC = require('../models/nbfc/NBFC');

class NBFCCache {
  constructor() {
    this.cache = new NodeCache({ 
      stdTTL: 3600, // 1 hour
      checkperiod: 600 // Check every 10 min
    });
  }

  async getActiveNBFCs() {
    const cacheKey = 'active_nbfcs';
    let nbfcs = this.cache.get(cacheKey);
    
    if (!nbfcs) {
      console.log('🔄 Fetching NBFCs from database...');
      nbfcs = await NBFC.find({
        isActive: true,
        "loanConfig.enabled": true,
      })
        .select('companyName email loanConfig stats') // Only needed fields
        .lean();
      
      this.cache.set(cacheKey, nbfcs);
      console.log(`✅ Cached ${nbfcs.length} NBFCs`);
    } else {
      console.log(`✅ Using cached NBFCs (${nbfcs.length})`);
    }
    
    return nbfcs;
  }

  invalidate() {
    this.cache.flushAll();
    console.log('🗑️ NBFC cache invalidated');
  }
}

module.exports = new NBFCCache();
