"""Create the first real administrator interactively, without demo seed or defaults."""
import argparse,getpass,os
from datetime import datetime,timezone
from pathlib import Path
import bcrypt
from dotenv import load_dotenv
from pymongo import MongoClient
from .validation import credentials,text
from .domain import normalize_phone

if __name__=='__main__':
    load_dotenv(Path(__file__).resolve().parents[1]/'.env')
    parser=argparse.ArgumentParser();parser.add_argument('--email',required=True);parser.add_argument('--name',required=True);parser.add_argument('--phone',required=True);args=parser.parse_args()
    password=getpass.getpass('Пароль нового администратора: ')
    if password!=getpass.getpass('Повторите пароль: '):raise SystemExit('Пароли не совпадают')
    data=credentials({'email':args.email,'password':password});data['name']=args.name;text(data,'name',2,80);phone=normalize_phone(args.phone)
    client=MongoClient(os.environ['MONGODB_URI']);db=client.get_default_database()
    try:
        if db.users.count_documents({'role':'admin'}):raise SystemExit('Администратор уже существует. Назначайте роли через существующую учётную запись.')
        if db.users.find_one({'email':data['email']}):raise SystemExit('Email уже используется. Существующая запись не изменена.')
        now=datetime.now(timezone.utc)
        db.users.insert_one({'email':data['email'],'name':data['name'],'phone':phone,'role':'admin','passwordHash':bcrypt.hashpw(password.encode(),bcrypt.gensalt(12)).decode(),'ageConfirmed':False,'licenseConfirmed':False,'createdAt':now,'updatedAt':now})
        print('Первый администратор создан. Пароль и персональные данные не выводятся.')
    finally:client.close()
