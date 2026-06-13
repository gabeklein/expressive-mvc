import './App.css';

// Form is kept separate as a reusable base class.
import { Form } from "./Form";
import { Preview } from "./Preview";

// Extending Form inherits the plumbing; can focus on values and layout.
class MyForm extends Form {
  firstname = '';
  lastname = '';
  email = '';

  // Methods and behavior are entirely up to you.
  submit(){
    if(!this.firstname || !this.lastname || !this.email){
      alert('Please fill out all fields');
      return;
    }

    alert(`Submitting ${this.firstname} ${this.lastname} with email ${this.email}`);
  }

  // Optional: render makes this self-contained.
  // Without it, children render in context of the form.
  render(){
    const { input, submit } = this;

    return (
      <div className="form">
        <h1>Example Form</h1>
        <input ref={input.firstname} placeholder="Firstname" />
        <input ref={input.lastname} placeholder="Lastname" />
        <input ref={input.email} placeholder="Email Address" />
        <button onClick={submit}>Submit</button>
        <Preview />
      </div>
    );
  }
}

// And just like that, we have a form component!
export default MyForm;
