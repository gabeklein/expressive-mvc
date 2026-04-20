// Check out form component for plumbing.
// We keep it separate because it's perfectly reusable.
// Might like more than one form so nice to have a base class.
import { Form } from "./Form";
import { Preview } from "./Preview";

// Here "extends Form" supplies the contract and logic.
// We can focus on business logic and the look.
class MyForm extends Form {
  firstname = '';
  lastname = '';
  email = '';

  // We can toss in a submit method to handle button.
  // Method names and behavior are fully up to you!
  submit(){
    if(!this.firstname || !this.lastname || !this.email){
      alert('Please fill out all fields');
      return;
    }

    alert(`Submitting ${this.firstname} ${this.lastname} with email ${this.email}`);
  }

  // Optional: render makes this self-contained.
  // Without it, children render with this form in context.
  render(){
    const { input, submit } = this;

    return (
      <div>
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

// And just like that, we have a self-contained form!
export default MyForm;
