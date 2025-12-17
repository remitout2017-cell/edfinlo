// seedSuperAdmin.js
const mongoose = require("mongoose");
const config = require("./config/config");
const Admin = require("./models/Admin");

async function run() {
  await mongoose.connect(config.mongoUri);

  const email = "aryanmadkar70@gmail.com";
  const existing = await Admin.findOne({ email });
  if (existing) {
    console.log("Superadmin already exists:", email);
    process.exit(0);
  }

  const superadmin = await Admin.create({
    name: "Super Admin",
    email,
    password: "Admin@123", // change after first login
    role: "superadmin",
    permissions: [], // not needed for superadmin
  });

  console.log("Created superadmin:", superadmin.email);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
