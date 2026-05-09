const mongoose = require('mongoose');

async function fix() {
  await mongoose.connect('mongodb://localhost:27017/recruitpro');
  const col = mongoose.connection.db.collection('companies');
  
  const all = await col.find({ slug: 'techiworld' }).toArray();
  console.log('Total docs with slug "techiworld":', all.length);
  
  if (all.length > 1) {
    // Keep the first, remove the rest
    const idsToRemove = all.slice(1).map(d => d._id);
    const r = await col.deleteMany({ _id: { $in: idsToRemove } });
    console.log('Removed duplicates:', r.deletedCount);
  } else {
    console.log('No duplicates to remove');
  }
  
  process.exit(0);
}

fix().catch(e => { console.error(e); process.exit(1); });
