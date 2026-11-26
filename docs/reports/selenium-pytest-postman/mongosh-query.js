const d=db.getSiblingDB("avtobaza_e2e");
print("DATABASE: "+d.getName()+" | MongoDB "+db.version());
print("Active cars: "+d.cars.countDocuments({archived:false}));
print("Cars (first 4):");
for(const c of d.cars.find({archived:false},{_id:0,brand:1,model:1,dailyRate:1}).sort({brand:1}).limit(4)) print(JSON.stringify(c));
print("Last completed rental:");
print(JSON.stringify(d.rentals.findOne({status:"completed"},{_id:0,carName:1,from:1,to:1,status:1,returnMileage:1,"history.status":1})));
print("Latest registration consent (no personal fields):");
print(JSON.stringify(d.users.find({"legal.consentVersion":{$exists:true}},{_id:0,role:1,legal:1}).sort({createdAt:-1}).limit(1).toArray()[0]));