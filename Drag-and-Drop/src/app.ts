enum ProjectStatus { ACTIVE, FINISHED }

interface Draggable {
    dragStartHandler(event: DragEvent): void;
    dragEndHandler(event: DragEvent): void;
}

interface DragTarget {
    dragOverHandler(event: DragEvent): void;
    dropHandler(event: DragEvent): void;
    dragLeaveHandler(event: DragEvent): void;
}

class Project {
    constructor(public id: string, public title: string, public description: string, public people: number, public status: ProjectStatus) {

    }
}

type Listener<T> = (items: T[]) => void

class State<T>{
    protected listeners: Listener<T>[] = [];
    addListener(listener: Listener<T>) {
        this.listeners.push(listener);
    }
}

class ProjectState extends State<Project>{
    private projects: Project[] = [];
    private static instance: ProjectState;

    constructor() {
        super();
    }

    addProject(title: string, description: string, numOfPeolple: number) {
        const newProject = new Project(Math.random().toString(), title, description, numOfPeolple, ProjectStatus.ACTIVE);
        this.projects.push(newProject);
        this.updateListeners()
        
    }

    static getInstance() {
        if (this.instance) {
            return this.instance;
        }

        this.instance = new ProjectState();
        return this.instance;
        
    }

    moveProject(projectId:string, newStatus: ProjectStatus){
        const project = this.projects.filter(prj => prj.id === projectId);
        if(project){
            project[0].status = newStatus;
        }

        this.updateListeners()
    }

    private updateListeners(){
        for (const listenerFn of this.listeners) {
            listenerFn(this.projects.slice());
        }
    }
}

const projectState: ProjectState = ProjectState.getInstance();

interface Validatable {
    value: string | number;
    require: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
}

function validate(validatebleInput: Validatable) {
    let isValid = true;
    if (validatebleInput.require) {
        isValid = isValid && validatebleInput.value.toString().trim().length != 0;
    }

    if (validatebleInput.minLength != null && typeof validatebleInput.value == "string") {
        isValid = isValid && validatebleInput.value.length > validatebleInput.minLength;
    }
    if (validatebleInput.maxLength != null && typeof validatebleInput.value == "string") {
        isValid = isValid && validatebleInput.value.length < validatebleInput.maxLength;
    }
    if (validatebleInput.min != null && typeof validatebleInput.value == "number") {
        isValid = isValid && validatebleInput.value > validatebleInput.min;
    }
    if (validatebleInput.max != null && typeof validatebleInput.value == "number") {
        isValid = isValid && validatebleInput.value < validatebleInput.max;
    }
    return isValid
}

function Autobind(target: any, methodName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const adjDescriptor: PropertyDescriptor = {
        configurable: true,
        get() {
            const boundFn = originalMethod.bind(this);
            return boundFn;
        }
    };
    return adjDescriptor;
}

abstract class Component<T extends HTMLElement, U extends HTMLElement>{
    templateElement: HTMLTemplateElement;
    hostElement: T;
    element: U;

    constructor(templateId: string, hostElementId: string, insertAtStart: boolean, newElementId?: string) {
        this.templateElement = document.getElementById(templateId)! as HTMLTemplateElement;
        this.hostElement = document.getElementById(hostElementId)! as T;

        const importedNode = document.importNode(this.templateElement.content, true);

        this.element = importedNode.firstElementChild as U;

        if (newElementId)
            this.element.id = newElementId;

        this.attach(insertAtStart);
    }

    private attach(insertAtBeggining: boolean) {
        this.hostElement.insertAdjacentElement(insertAtBeggining ? 'afterbegin' : "beforeend", this.element);
    }

    abstract configure(): void;
    abstract renderContent(): void;
}

class ProjectItem extends Component<HTMLUListElement, HTMLLIElement> implements Draggable {

    private project: Project;

    get persons() {
        return this.project.people.toString() + (this.project.people === 1 ? " person " : " persons ")
    }

    constructor(hostId: string, project: Project) {
        super('single-project', hostId, false, project.id);
        this.project = project;
        this.renderContent();
        this.configure();
    }

    renderContent() {
        this.element.querySelector("h2")!.textContent = this.project.title;
        this.element.querySelector("h3")!.textContent = this.persons + "assigned";
        this.element.querySelector("p")!.textContent = this.project.description;
    }

    @Autobind
    dragStartHandler(event: DragEvent) {
        event.dataTransfer!.setData('text/plain', this.project.id);
        event.dataTransfer!.effectAllowed = "move";
    }

    dragEndHandler(event: DragEvent) {

    }

    configure() {
        this.element.addEventListener("dragstart", this.dragStartHandler)
        this.element.addEventListener("dragend", this.dragEndHandler)
    }
}

class ProjectList extends Component<HTMLDivElement, HTMLElement> implements DragTarget {


    assignedProjects: Project[];

    constructor(private type: 'active' | 'finished') {
        super("project-list", "app", false, `${type}-projects`)

        this.assignedProjects = []

        this.configure();

        this.element.id = `${this.type}-projects`;
        this.renderContent();
    }

    private renderProjects() {
        const listEl = document.getElementById(`${this.type}-projects-list`) as HTMLUListElement;
        listEl.innerHTML = '';
        for (const prjItem of this.assignedProjects) {
            new ProjectItem(this.element.querySelector("ul")!.id, prjItem);
        }
    }

    configure() {
        this.element.addEventListener("dragover", this.dragOverHandler);
        this.element.addEventListener("dragleave", this.dragLeaveHandler);
        this.element.addEventListener("drop", this.dropHandler);
        projectState.addListener((projects: Project[]) => {
            const relevantProjects = projects.filter(prj => {
                return this.type === "active" ? prj.status === ProjectStatus.ACTIVE : prj.status === ProjectStatus.FINISHED
            });
            this.assignedProjects = relevantProjects;
            this.renderProjects();
        });
    }

    renderContent() {
        const listId = `${this.type}-projects-list`;
        this.element.querySelector("ul")!.id = listId;
        this.element.querySelector("h2")!.textContent = this.type.toUpperCase() + " PROJECTS";
    }

    @Autobind
    dragOverHandler(event: DragEvent): void {
        if (event.dataTransfer && event.dataTransfer.types[0] === "text/plain") {
            event.preventDefault();
            const listEl = this.element.querySelector("ul")!
            listEl.classList.add("droppable");
        }
    }

    @Autobind
    dropHandler(event: DragEvent): void {
        const projId = event.dataTransfer!.getData("text/plain");
        projectState.moveProject(projId, this.type === "active" ? ProjectStatus.ACTIVE : ProjectStatus.FINISHED);
    }

    @Autobind
    dragLeaveHandler(event: DragEvent): void {
        const listEl = this.element.querySelector("ul")!
        listEl.classList.remove("droppable");
    }
}

class ProjectInput extends Component<HTMLDivElement, HTMLFormElement>{

    titleInputElement: HTMLInputElement;
    descriptionInputElement: HTMLInputElement;
    peopleInputElement: HTMLInputElement;

    constructor() {
        super("project-input", "app", true, "user-input");

        this.titleInputElement = document.querySelector("#title")! as HTMLInputElement;
        this.descriptionInputElement = document.querySelector("#description")! as HTMLInputElement;
        this.peopleInputElement = document.querySelector("#people")! as HTMLInputElement;


        this.configure();

    }

    private gatherUserInput(): ([string, string, number] | void) {
        const enteredTitle = this.titleInputElement.value;
        const enteredDescription = this.descriptionInputElement.value;
        const enteredPeople = this.peopleInputElement.value;

        const titleValidate: Validatable = { value: enteredTitle, require: true }
        const descValidate: Validatable = { value: enteredDescription, require: true, minLength: 5 }
        const peopleValidate: Validatable = { value: enteredPeople, require: true, min: 1, max: 5 }

        if (!validate(titleValidate) || !validate(descValidate) || !validate(peopleValidate)) {
            alert("Please fill the inputs correct!");
            return;
        }

        return [enteredTitle, enteredDescription, +enteredPeople];
    }

    private clearForm() {
        this.titleInputElement.value = "";
        this.descriptionInputElement.value = "";
        this.peopleInputElement.value = "";
    }

    @Autobind
    private submitHandler(e: Event) {
        e.preventDefault();
        const userInput = this.gatherUserInput();

        if (Array.isArray(userInput)) {
            const [title, description, people] = userInput;
            projectState.addProject(title, description, people);
            this.clearForm();
        }
    }

    configure() {
        this.element.addEventListener("submit", this.submitHandler);
    }

    renderContent() { }
}

const proj = new ProjectInput();
const activeProjList = new ProjectList("active");
const finishedProjList = new ProjectList("finished");