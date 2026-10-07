import type{SavedCase}from'../core/models';
import{migrateCases}from'../core/migration';
import type{CaseRepository}from'../ports/case-repository.port';
const KEY='c2c-006.cases.v1';
export class LocalCaseRepository implements CaseRepository{
  constructor(private storage:Storage){}
  list():SavedCase[]{
    try{
      const migrated=migrateCases(JSON.parse(this.storage.getItem(KEY)??'[]'));
      this.storage.setItem(KEY,JSON.stringify(migrated));
      return migrated;
    }catch{return[]}
  }
  save(value:SavedCase){
    const all=this.list().filter(c=>c.draft.id!==value.draft.id);
    all.unshift({version:2,...value});
    this.storage.setItem(KEY,JSON.stringify(all));
  }
  delete(id:string){
    this.storage.setItem(KEY,JSON.stringify(this.list().filter(c=>c.draft.id!==id)));
  }
}
