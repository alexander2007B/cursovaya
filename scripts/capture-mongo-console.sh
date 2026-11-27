#!/bin/bash
cd /workspace/testing-migration
printf '$ docker exec cursovaya-mongo-1 mongosh --quiet --eval <query>\n\n'
docker exec cursovaya-mongo-1 mongosh --quiet --eval 'const d=db.getSiblingDB("avtobaza_e2e");print("DATABASE: "+d.getName()+" | MongoDB "+db.version());print("Active cars: "+d.cars.countDocuments({archived:false}));print("Cars:");d.cars.find({archived:false},{_id:0,brand:1,model:1,dailyRate:1}).sort({brand:1}).limit(4).forEach(c=>print(JSON.stringify(c)));print("Last completed rental:");print(JSON.stringify(d.rentals.findOne({status:"completed"},{_id:0,carName:1,from:1,to:1,status:1,returnMileage:1})));' | tee docs/reports/red-green/mongo-console.txt
printf '\n$ '
read -r unused
