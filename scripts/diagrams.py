from pathlib import Path
import subprocess
import textwrap
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, FancyArrowPatch
plt.rcParams['font.family']='DejaVu Sans'
plt.rcParams['svg.fonttype']='none'
root=Path(__file__).resolve().parents[1]/'docs/diagrams'
def idef(name,title,items,inputs,outputs,controls,mechanism):
 # Plain IDEF0 worksheet: white blocks, orthogonal connectors and a node strip.
 fig,ax=plt.subplots(figsize=(12,5.2))
 ax.set_xlim(0,12);ax.set_ylim(0,5.2);ax.axis('off')
 ink='#181818'
 ax.add_patch(Rectangle((.12,.12),11.76,4.96,fill=False,edgecolor=ink,linewidth=.8))
 ax.plot([.12,11.88],[.57,.57],color=ink,lw=.8)
 ax.plot([1.55,1.55],[.12,.57],color=ink,lw=.8)
 ax.plot([10.65,10.65],[.12,.57],color=ink,lw=.8)
 node='A-0' if name=='idef_context' else ('A0' if name=='idef_a0' else 'A2')
 sheet={'idef_context':'1','idef_a0':'2','idef_a2':'3'}[name]
 ax.text(.3,.34,'Узел: '+node,fontsize=10.5,va='center')
 ax.text(6.1,.34,title.replace('IDEF0. ',''),fontsize=11,ha='center',va='center')
 ax.text(11.25,.34,'Лист '+sheet,fontsize=10.5,ha='center',va='center')
 def arrow(points):
  for a,b in zip(points[:-2],points[1:-1]):ax.plot([a[0],b[0]],[a[1],b[1]],color=ink,lw=1)
  ax.add_patch(FancyArrowPatch(points[-2],points[-1],arrowstyle='-|>',mutation_scale=10,linewidth=1,color=ink,shrinkA=0,shrinkB=0))
 def box(x,y,w,h,code,text):
  ax.add_patch(Rectangle((x,y),w,h,facecolor='white',edgecolor=ink,linewidth=1.2))
  ax.text(x+w/2,y+h*.57,text,ha='center',va='center',fontsize=12 if len(items)==1 else 11.5,linespacing=1.25)
  ax.text(x+w-.1,y+.1,code,ha='right',va='bottom',fontsize=10)
 if len(items)==1:
  x,y,w,h=4.15,2.15,3.7,1.25
  box(x,y,w,h,*items[0])
  arrow([(.45,2.78),(x,2.78)])
  arrow([(x+w,2.78),(11.55,2.78)])
  ax.text(.5,3.12,inputs,fontsize=11.5,ha='left',va='bottom')
  ax.text(11.5,3.12,outputs,fontsize=11.5,ha='right',va='bottom')
  labels=controls.split(' • ')
  for i,label in enumerate(labels):
   tx=3.0+i*3;bx=x+.65+i*1.2
   ax.text(tx,4.67,label,ha='center',va='bottom',fontsize=11)
   arrow([(tx,4.48),(tx,3.9),(bx,3.9),(bx,y+h)])
  labels=mechanism.split(' • ')
  for i,label in enumerate(labels):
   tx=2.15+i*2.55;bx=x+.45+i*.93
   ax.text(tx,.87,label,ha='center',va='center',fontsize=11)
   arrow([(tx,1.05),(tx,1.65),(bx,1.65),(bx,y)])
 else:
  w,h=1.92,.93
  positions=[(1.7+i*2.35,3.22-i*.5) for i in range(len(items))]
  for (x,y),(code,text) in zip(positions,items):box(x,y,w,h,code,text)
  for (x,y),(nx,ny) in zip(positions,positions[1:]):
   elbow=nx-.28
   arrow([(x+w,y+h/2),(elbow,y+h/2),(elbow,ny+h/2),(nx,ny+h/2)])
  x,y=positions[0];arrow([(.4,y+h/2),(x,y+h/2)])
  ax.text(.45,y+h*.85,inputs,fontsize=11.5,ha='left',va='bottom')
  x,y=positions[-1];arrow([(x+w,y+h/2),(11.62,y+h/2)])
  output_label='\n'.join(textwrap.fill(line,width=12) for line in outputs.splitlines())
  ax.text(11.65,y+h*.85,output_label,fontsize=11,ha='right',va='bottom')
  ax.text(6,4.82,controls,fontsize=11.5,ha='center',va='center')
  xs=[x+w/2 for x,y in positions]
  ax.plot([xs[0],xs[-1]],[4.52,4.52],color=ink,lw=1)
  ax.plot([xs[0],xs[-1]],[1.02,1.02],color=ink,lw=1)
  for x,y in positions:
   arrow([(x+w/2,4.52),(x+w/2,y+h)])
   arrow([(x+w/2,1.02),(x+w/2,y)])
  ax.text(6,.76,mechanism,fontsize=11.5,ha='center',va='center')
 fig.tight_layout(pad=.2)
 fig.savefig(root/(name+'.png'),dpi=220,bbox_inches='tight',pad_inches=.04)
 fig.savefig(root/(name+'.svg'),bbox_inches='tight',pad_inches=.04)
 plt.close(fig)
idef('idef_context','IDEF0. Контекст A-0',[('A0','Организовать аренду\nи учёт состояния автопарка')],'Запрос клиента;\nавтомобиль','Подтверждённая аренда;\nистория состояния','Условия аренды • Права пользователей • Регламент обслуживания','Клиент • Менеджер • Администратор • Информационная система')
idef('idef_a0','IDEF0. Декомпозиция A0',[('A1','Вести каталог\nи пользователей'),('A2','Оформлять\nбронирование'),('A3','Выдавать\nи принимать авто'),('A4','Учитывать\nтехсостояние')],'Исходные\nсведения','История\nи отчёт','Ролевая модель • Тарифы • Правила перехода статусов','React • Express • MongoDB • Сотрудники автобазы')
idef('idef_a2','IDEF0. Декомпозиция A2',[('A21','Проверить\nвходные данные'),('A22','Рассчитать\nстоимость'),('A23','Проверить\nпересечения'),('A24','Сохранить заявку\nи событие')],'Даты; авто;\nуслуги','Заявка /\nобъяснение отказа','Схемы Zod • Правила расчёта • Транзакция MongoDB','Клиент API • Сервис бронирования • Коллекции cars/rentals/events')
base='graph [fontname="DejaVu Sans",bgcolor="white",pad="0.3",ranksep="0.65",nodesep="0.35"]; node [fontname="DejaVu Sans",fontsize=11,shape=box,style="filled",fillcolor="white",color="#181818",margin="0.15"]; edge [fontname="DejaVu Sans",fontsize=9,color="#181818"];'
graphs={
'architecture':'''rankdir=TB; browser[label="Браузер\nReact / Router / CSS"]; api[label="Express API\nправа / валидация / расчёт"]; db[label="MongoDB replica set\nсессии / документы / индексы",shape=cylinder]; browser->api[label="HTTP JSON + cookie + CSRF"]; api->db[label="Mongoose / транзакции"]; db->api[label="Документы"]; api->browser[label="Ответ / ошибка"];''',
'er':r'''rankdir=LR; node[shape=record]; users[label="users|_id : ObjectId PK\lname : string\lemail : unique\lphone : string\lageConfirmed, licenseConfirmed : bool\ldrivingExperience : int\lpasswordHash : string\lrole : enum\l"]; cars[label="cars|_id : ObjectId PK\lplate : unique\lbrand, model : string\ldailyRate, deposit : int\limage : string; gallery : array\lmileage : int\lstatus, archived\llockVersion : int\l"]; rentals[label="rentals|_id : ObjectId PK\lnumber : unique\luser, car : ObjectId\lfrom, to : YYYY-MM-DD\lquote : embedded\lextras : embedded\lstatus : enum\lhistory : array\l"]; maintenance[label="maintenances|_id : ObjectId PK\lcar, author : ObjectId\lnode, note : string\lwear, mileage : int\l"]; events[label="events|_id : ObjectId PK\lactor : ObjectId\laction, entity, details\lcreatedAt : Date\l"]; users->rentals[label="1 : N / user"]; cars->rentals[label="1 : N / car"]; cars->maintenance[label="1 : N"];users->maintenance[label="1 : N / author"];users->events[label="1 : N / actor"];''',
'dfd':'''rankdir=TB; client[label="Клиент",shape=box]; manager[label="Сотрудник",shape=box]; p1[label="1.0\nОбработать заявку",shape=ellipse];p2[label="2.0\nОбработать выдачу",shape=ellipse];p3[label="3.0\nУчесть состояние",shape=ellipse];d1[label="D1 Автомобили",shape=cylinder];d2[label="D2 Аренды",shape=cylinder];d3[label="D3 Осмотры",shape=cylinder];client->p1[label="Даты, услуги"];p1->client[label="Цена, номер заявки"];d1->p1[label="Тариф / статус"];p1->d2[label="Заявка"];d2->p1[label="Занятые интервалы"];manager->p2[label="Решение, пробег"];p2->d2[label="Новый статус"];p2->d1[label="Пробег"];manager->p3[label="Результат осмотра"];p3->d3[label="Запись осмотра"];p3->d1[label="Пробег"];''',
'usecase':'''rankdir=TB;client[label="«actor»\nКлиент"];manager[label="«actor»\nМенеджер"];admin[label="«actor»\nАдминистратор"];node[shape=ellipse];catalog[label="Найти автомобиль"];book[label="Оформить / отменить заявку"];profile[label="Просмотреть свои аренды"];process[label="Подтвердить / выдать / принять"];service[label="Записать осмотр / статус авто"];fleet[label="Вести каталог и тарифы"];roles[label="Назначить роли"];client->catalog;client->book;client->profile;manager->process;manager->service;admin->fleet;admin->roles;admin->manager[label="обобщение",arrowhead=empty];manager->client[label="обобщение",arrowhead=empty];''',
'classes':r'''rankdir=LR;node[shape=record];Car[label="Car|dailyRate: number\ldeposit: number\lstatus: enum\llockVersion: number\l|reserveInterval()\lchangeStatus()\larchive()\l"];Rental[label="Rental|from, to: string\lquote: Quote\lstatus: enum\lhistory: array\l|validateTransition()\lcomplete(returnMileage)\l"];User[label="User|email: string\lpasswordHash: string\lrole: enum\l|publicUser()\l"];Quote[label="Quote|days, base: number\linsurance, childSeat: number\ltotal, deposit: number\l|calculateQuote()\l"];Maintenance[label="Maintenance|node: string\lwear, mileage: number\lnote: string\l"];User->Rental[label="1     0..*"];Car->Rental[label="1     0..*"];Car->Maintenance[label="1     0..*"];Rental->Quote[arrowhead=diamond,label="снимок цены"];''',
'activity':'''start[label="Начало",shape=circle,width=.3];auth[label="Вход и ввод дат"];valid[label="Входные данные\nкорректны?",shape=diamond];tx[label="Начать транзакцию\nзаписать lockVersion"];free[label="Исправен и нет\nпересечений?",shape=diamond];save[label="Сохранить заявку и событие\ncommit"];err[label="Показать причину отказа"];end[label="Конец",shape=doublecircle];start->auth;auth->valid;valid->tx[label="да"];valid->err[label="нет"];tx->free;free->save[label="да"];free->err[label="нет / rollback"];save->end;err->end;''',
'states':'''rankdir=TB;new[label="Новая"];confirmed[label="Подтверждена"];active[label="Активна"];completed[label="Завершена"];cancelled[label="Отменена"];new->confirmed[label="менеджер"];confirmed->active[label="выдача в период аренды"];active->completed[label="возврат + пробег"];new->cancelled[label="владелец / сотрудник"];confirmed->cancelled[label="владелец / сотрудник"];'''
}
for name,body in graphs.items():
 source='digraph G {'+base+body+'}'
 (root/(name+'.dot')).write_text(source)
 subprocess.run(['dot','-Tpng','-Gdpi=160',str(root/(name+'.dot')),'-o',str(root/(name+'.png'))],check=True)
 subprocess.run(['dot','-Tsvg',str(root/(name+'.dot')),'-o',str(root/(name+'.svg'))],check=True)
fig,ax=plt.subplots(figsize=(12,7));ax.set_xlim(0,12);ax.set_ylim(0,8);ax.axis('off')
actors=[('Клиент',1.1),('React',4),('Express',7),('MongoDB',10.5)]
for name,x in actors:
 ax.add_patch(Rectangle((x-.8,7.35),1.6,.55,facecolor='white',edgecolor='#181818'));ax.text(x,7.62,name,ha='center',va='center',fontsize=11);ax.plot([x,x],[.2,7.35],'--',color='#777777')
for y,a,b,label in [(6.8,1.1,4,'1. Нажать «Забронировать»'),(6.05,4,7,'2. POST /api/rentals + CSRF'),(5.3,7,10.5,'3. Начать транзакцию; lockVersion++'),(4.55,7,10.5,'4. Проверить пересечения'),(3.8,10.5,7,'5. Свободно'),(3.05,7,10.5,'6. INSERT rental + event; COMMIT'),(2.3,10.5,7,'7. Подтверждение записи'),(1.55,7,4,'8. HTTP 201 + заявка'),(.8,4,1.1,'9. Показать номер заявки')]:
 ax.annotate('',xy=(b,y),xytext=(a,y),arrowprops={'arrowstyle':'->','color':'#181818'});ax.text((a+b)/2,y+.12,label,ha='center',fontsize=8.5)
fig.tight_layout();fig.savefig(root/'sequence.png',dpi=180,bbox_inches='tight');fig.savefig(root/'sequence.svg',bbox_inches='tight');plt.close(fig)
print('Diagrams created')

# Keep generated SVG source clean and readable in version control.
for svg in root.glob("*.svg"):
 svg.write_text("\n".join(line.rstrip() for line in svg.read_text().splitlines())+"\n")
